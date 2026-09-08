"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isChildOfGuardianUser } from "@/lib/parents";
import { finalizeSession } from "@/lib/session-lifecycle";

/**
 * Parent AI chat (v6): a guardian's own session ABOUT their child — the
 * third surface of the shared chat handler. Reuses core.ai_sessions with
 * session_kind 'parent' so safety classification and safeguarding
 * escalation cover this surface too. No transcript is persisted (v7
 * privacy-framework decision) and no consent gate applies: the parent is
 * the consent-giver, and the data tools carry their own consent checks.
 */

/** A parent chat left open is closed lazily after this long. */
const PARENT_SESSION_MAX_HOURS = 12;

export async function startParentChatAction(formData: FormData) {
  const user = await requireAppUser("guardian");
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) throw new Error("studentId required");

  const db = getDb();
  const { ok } = await isChildOfGuardianUser(db, user.id, studentId);
  if (!ok) throw new Error("Not your child");

  // Sweep this guardian's stale parent chats; resume a still-live one.
  const actives = await db
    .select()
    .from(s.aiSessions)
    .where(
      and(
        eq(s.aiSessions.startedBy, user.id),
        eq(s.aiSessions.sessionKind, "parent"),
        eq(s.aiSessions.status, "active"),
      ),
    );
  for (const active of actives) {
    const expired =
      Date.now() - new Date(active.startedAt).getTime() > PARENT_SESSION_MAX_HOURS * 3600_000;
    if (expired) {
      await finalizeSession({
        session: { id: active.id, studentId: active.studentId },
        endedReason: "time_limit",
        actor: { type: "system" },
      });
    } else if (active.studentId === studentId) {
      redirect(`/parent/chat/${active.id}`);
    }
  }

  const [session] = await db
    .insert(s.aiSessions)
    .values({
      studentId,
      startedBy: user.id,
      startedByRole: "guardian",
      supervisionMode: "parent_present",
      sessionKind: "parent",
      status: "active",
    })
    .returning({ id: s.aiSessions.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "session_started",
    entityType: "ai_session",
    entityId: session!.id,
    details: { studentId, kind: "parent" },
  });

  redirect(`/parent/chat/${session!.id}`);
}

export async function endParentChatAction(formData: FormData) {
  const user = await requireAppUser("guardian");
  const sessionId = String(formData.get("sessionId") ?? "");

  const db = getDb();
  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session) redirect("/parent");
  if (session.startedBy !== user.id || session.sessionKind !== "parent") {
    throw new Error("Not your chat");
  }

  await finalizeSession({
    session: { id: session.id, studentId: session.studentId },
    endedReason: "Parent ended",
    actor: { type: "user", id: user.id },
  });

  redirect(`/parent/children/${session.studentId}`);
}
