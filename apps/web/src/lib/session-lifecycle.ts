import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { schema as s } from "@platform/db";
import { checkConsent, writeAudit, type TranscriptMessage } from "@platform/shared";
import { runPostSessionPass } from "@/lib/ai/post-session";
import { getDb } from "@/lib/db";
import { clearKioskHistory, kioskHistory } from "@/lib/kiosk-state";

/**
 * One place a session ends — teacher button, student button, or the lazy
 * time-limit check in the chat route. Update → audit → consent-gated
 * transcript → post-session observation pass (after()) → clear context.
 * Session lifecycle is app_user work; ai_agent has no UPDATE grant here.
 */
export async function finalizeSession(args: {
  session: { id: string; studentId: string };
  endedReason: string;
  actor: { type: "user" | "system"; id?: string | null };
}): Promise<void> {
  const db = getDb();
  const { session } = args;

  await db
    .update(s.aiSessions)
    .set({ endedAt: new Date().toISOString(), status: "ended", endedReason: args.endedReason.slice(0, 50) })
    .where(eq(s.aiSessions.id, session.id));

  await writeAudit(db, {
    actorType: args.actor.type,
    actorId: args.actor.id ?? null,
    action: "session_ended",
    entityType: "ai_session",
    entityId: session.id,
    details: { reason: args.endedReason },
  });

  // Transcript persists ONLY when conversation_storage is granted at end time.
  const { granted } = await checkConsent(db, session.studentId, ["conversation_storage"]);
  const history = kioskHistory(session.id);
  if (granted && history.length > 0) {
    const messages: TranscriptMessage[] = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({
        role: m.role === "user" ? ("student" as const) : ("assistant" as const),
        text: m.content as string,
      }));
    const retentionDays = Number(process.env.TRANSCRIPT_RETENTION_DAYS || 365);
    await db.insert(s.sessionTranscripts).values({
      sessionId: session.id,
      messages,
      expiresAt: new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString(),
    });
    await writeAudit(db, {
      actorType: "system",
      action: "transcript_saved",
      entityType: "ai_session",
      entityId: session.id,
      details: { messageCount: messages.length },
    });
  }

  // Per-session observation pass (design §9): capture the evidence BEFORE
  // clearing the running context; runs after the response.
  if (history.length > 0) {
    const transcriptText = history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => `${m.role === "user" ? "student" : "tutor"}: ${m.content as string}`)
      .join("\n");
    const activities = await db
      .select({
        activityType: s.sessionActivities.activityType,
        topic: s.sessionActivities.topic,
        attempted: s.sessionActivities.attempted,
        correct: s.sessionActivities.correct,
        hintsUsed: s.sessionActivities.hintsUsed,
        engagementLevel: s.sessionActivities.engagementLevel,
      })
      .from(s.sessionActivities)
      .where(eq(s.sessionActivities.sessionId, session.id));

    after(() =>
      runPostSessionPass({
        sessionId: session.id,
        studentId: session.studentId,
        activities,
        transcriptText: transcriptText || null,
      }),
    );
  }

  clearKioskHistory(session.id);
}
