"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { checkConsent, writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeSession } from "@/lib/session-lifecycle";
import { studentForUser } from "@/lib/student";

/**
 * Home Mode (v5): the student starts their OWN session — no teacher in the
 * loop. Gates, in order: role, linked+active student, admin-enabled
 * unsupervised access, ai_interaction consent, allowed hours. Stale actives
 * are closed lazily here (no cron by design); a live active session is
 * resumed rather than duplicated.
 */

const CENTRE_TIMEZONE = "Asia/Kuala_Lumpur";

function centreTimeHHMMSS(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTRE_TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

export async function startStudentSessionAction(formData: FormData) {
  const user = await requireAppUser("student");
  const kindRaw = String(formData.get("kind") ?? "");
  const kind = kindRaw === "daily" ? ("daily" as const) : ("academic" as const);
  // Learning Workspace (v6): a Learn session may be anchored to a teacher-set
  // material. Only academic sessions can carry one.
  const materialIdRaw = String(formData.get("materialId") ?? "");
  const materialId = kind === "academic" && materialIdRaw ? materialIdRaw : null;

  const db = getDb();
  const student = await studentForUser(user.id);
  if (!student) throw new Error("Your account isn't linked to a student — ask your teacher");
  if (student.status !== "active") throw new Error("This account is not active");
  if (!student.unsupervisedAccessEnabled) {
    throw new Error("Home access is not switched on — ask your teacher");
  }

  const { granted } = await checkConsent(db, student.id, ["ai_interaction"]);
  if (!granted) throw new Error("AI chat permission has not been given for this account");

  if (student.allowedHoursStart && student.allowedHoursEnd) {
    const now = centreTimeHHMMSS();
    if (now < student.allowedHoursStart || now > student.allowedHoursEnd) {
      throw new Error("It's outside your chat hours right now — see you later!");
    }
  }

  if (materialId) {
    const material = (
      await db
        .select()
        .from(s.teachingMaterials)
        .where(eq(s.teachingMaterials.id, materialId))
        .limit(1)
    )[0];
    if (!material || material.studentId !== student.id || !material.isActive) {
      throw new Error("That task isn't available — ask your teacher");
    }
  }

  // Sweep this student's stale active sessions; resume a still-live one.
  const actives = await db
    .select()
    .from(s.aiSessions)
    .where(and(eq(s.aiSessions.studentId, student.id), eq(s.aiSessions.status, "active")));
  const minutes = student.maxSessionMinutes ?? 45;
  for (const active of actives) {
    const expired = Date.now() - new Date(active.startedAt).getTime() > minutes * 60_000;
    if (expired) {
      await finalizeSession({
        session: { id: active.id, studentId: student.id },
        endedReason: "time_limit",
        actor: { type: "system" },
      });
    } else if (
      active.startedBy === user.id &&
      active.sessionKind === kind &&
      (active.materialId ?? null) === materialId
    ) {
      redirect(`/student/chat/${active.id}`);
    }
  }

  const [session] = await db
    .insert(s.aiSessions)
    .values({
      studentId: student.id,
      startedBy: user.id,
      startedByRole: "student",
      supervisionMode: "unsupervised",
      sessionKind: kind,
      assistMode: student.defaultAssistMode,
      materialId,
      status: "active",
    })
    .returning({ id: s.aiSessions.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "session_started",
    entityType: "ai_session",
    entityId: session!.id,
    details: { studentId: student.id, supervisionMode: "unsupervised", kind, ...(materialId ? { materialId } : {}) },
  });

  redirect(`/student/chat/${session!.id}`);
}

export async function endStudentSessionAction(formData: FormData) {
  const user = await requireAppUser("student");
  const sessionId = String(formData.get("sessionId") ?? "");

  const db = getDb();
  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session) redirect("/student");
  if (session.startedBy !== user.id) throw new Error("Not your session");

  await finalizeSession({
    session: { id: session.id, studentId: session.studentId },
    endedReason: "Student ended",
    actor: { type: "user", id: user.id },
  });

  redirect("/student");
}
