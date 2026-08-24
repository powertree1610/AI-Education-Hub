"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import {
  canUserAccessStudent,
  checkConsent,
  writeAudit,
  type TranscriptMessage,
} from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clearKioskHistory, kioskHistory } from "@/lib/kiosk-state";

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

  const [session] = await db
    .insert(s.aiSessions)
    .values({
      studentId,
      startedBy: user.id,
      startedByRole: user.role === "admin" ? "admin" : "teacher",
      supervisionMode: "supervised_centre",
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

  // Session lifecycle is app_user work — ai_agent has no UPDATE grant here.
  await db
    .update(s.aiSessions)
    .set({ endedAt: new Date().toISOString(), status: "ended", endedReason: "Teacher ended" })
    .where(eq(s.aiSessions.id, sessionId));

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "session_ended",
    entityType: "ai_session",
    entityId: sessionId,
  });

  // Transcript persists ONLY when conversation_storage is granted at end time.
  const { granted } = await checkConsent(db, session.studentId, ["conversation_storage"]);
  const history = kioskHistory(sessionId);
  if (granted && history.length > 0) {
    const messages: TranscriptMessage[] = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({
        role: m.role === "user" ? ("student" as const) : ("assistant" as const),
        text: m.content as string,
      }));
    const retentionDays = Number(process.env.TRANSCRIPT_RETENTION_DAYS || 365);
    await db.insert(s.sessionTranscripts).values({
      sessionId,
      messages,
      expiresAt: new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString(),
    });
    await writeAudit(db, {
      actorType: "system",
      action: "transcript_saved",
      entityType: "ai_session",
      entityId: sessionId,
      details: { messageCount: messages.length },
    });
  }
  clearKioskHistory(sessionId);

  revalidatePath("/teacher/sessions");
  redirect("/teacher/sessions");
}
