"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, checkConsent, writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeSession } from "@/lib/session-lifecycle";

export async function startSessionAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) throw new Error("studentId required");

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }

  // Hard consent gate: no ai_interaction consent → no kiosk session, at all.
  const { granted, missing } = await checkConsent(db, studentId, ["ai_interaction"]);
  if (!granted) {
    throw new Error(`Cannot start a session: consent not granted (${missing.join(", ")})`);
  }

  // Kiosk sessions are always academic; assist mode defaults to the
  // student's teacher-set policy, overridable per session at start.
  const student = (await db.select().from(s.students).where(eq(s.students.id, studentId)).limit(1))[0];
  const assistModeRaw = String(formData.get("assistMode") ?? "");
  const assistMode = (s.assistModeInCore.enumValues as readonly string[]).includes(assistModeRaw)
    ? (assistModeRaw as (typeof s.assistModeInCore.enumValues)[number])
    : (student?.defaultAssistMode ?? "learning");

  const [session] = await db
    .insert(s.aiSessions)
    .values({
      studentId,
      startedBy: user.id,
      startedByRole: user.role === "admin" ? "admin" : "teacher",
      supervisionMode: "supervised_centre",
      sessionKind: "academic",
      assistMode,
      deviceId: String(formData.get("deviceId") ?? "") || null,
      status: "active",
    })
    .returning({ id: s.aiSessions.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "session_started",
    entityType: "ai_session",
    entityId: session!.id,
    details: { studentId, supervisionMode: "supervised_centre" },
  });

  redirect(`/kiosk/${session!.id}`);
}

export async function endSessionAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();
  const sessionId = String(formData.get("sessionId") ?? "");

  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session) throw new Error("Active session not found");

  await finalizeSession({
    session: { id: sessionId, studentId: session.studentId },
    endedReason: "Teacher ended",
    actor: { type: "user", id: user.id },
  });

  revalidatePath("/teacher/sessions");
  redirect("/teacher/sessions");
}
