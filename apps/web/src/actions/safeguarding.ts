"use server";

import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSafeguardingLead } from "@/lib/guard";

/**
 * Safeguarding actions. Restricted-schema access is raw parameterized SQL
 * (only `core` is introspected into drizzle) over the app_user connection;
 * every audit row stays content-free — case text never enters core.audit_log.
 */

const CASE_STATUSES = ["open", "under_review", "actioned", "closed", "escalated"] as const;

async function requireLead() {
  const user = await requireAppUser();
  if (!(await isSafeguardingLead(user.id))) throw new Error("Safeguarding lead access required");
  return user;
}

export async function addReviewAction(formData: FormData) {
  const user = await requireLead();
  const recordId = String(formData.get("recordId") ?? "");
  const decision = String(formData.get("decision") ?? "").trim();
  const actionTaken = String(formData.get("actionTaken") ?? "").trim();
  const followUp = String(formData.get("followUp") ?? "").trim();
  if (!recordId || !decision) throw new Error("Decision is required");

  const db = getDb();
  await db.execute(sql`
    insert into restricted.safeguarding_reviews (record_id, reviewed_by, decision, action_taken, follow_up, reviewed_at)
    values (${recordId}, ${user.id}, ${decision.slice(0, 200)}, ${actionTaken || null}, ${followUp || null}, now())
  `);
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "safeguarding_review_added",
    entityType: "safeguarding_record",
    entityId: recordId,
  });
  revalidatePath(`/safeguarding/${recordId}`);
  redirect(`/safeguarding/${recordId}`);
}

export async function updateCaseStatusAction(formData: FormData) {
  const user = await requireLead();
  const recordId = String(formData.get("recordId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(CASE_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");

  const db = getDb();
  await db.execute(sql`
    update restricted.safeguarding_records set status = ${status}::restricted.safeguarding_status
    where id = ${recordId}
  `);
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "safeguarding_status_changed",
    entityType: "safeguarding_record",
    entityId: recordId,
    details: { status },
  });
  revalidatePath(`/safeguarding/${recordId}`);
  redirect(`/safeguarding/${recordId}`);
}

export async function markSafetyEventReviewedAction(formData: FormData) {
  const user = await requireAppUser();
  const lead = await isSafeguardingLead(user.id);
  if (user.role !== "admin" && !lead) throw new Error("Admin or safeguarding lead access required");

  const eventId = String(formData.get("eventId") ?? "");
  const backPath = formData.get("backPath") === "/safeguarding/events" ? "/safeguarding/events" : "/admin/safety";

  const db = getDb();
  await db
    .update(s.safetyEvents)
    .set({ reviewedBy: user.id, reviewedAt: sql`now()` })
    .where(eq(s.safetyEvents.id, eventId));
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "safety_event_reviewed",
    entityType: "safety_event",
    entityId: eventId,
  });
  revalidatePath(backPath);
  redirect(backPath);
}

/** Teacher referral: create-only. Teachers can raise a case; they can never
 *  list or read cases back (design §4). */
export async function createReferralAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const studentId = String(formData.get("studentId") ?? "");
  const factual = String(formData.get("factualRecord") ?? "").trim();
  const occurredOn = String(formData.get("occurredOn") ?? "").trim();
  if (factual.length < 10) throw new Error("Please describe what you saw or heard (at least 10 characters)");

  const db = getDb();
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, { userId: user.id, role: "teacher", studentId });
    if (!allowed) throw new Error("You are not assigned to this student");
  }

  await db.execute(sql`
    insert into restricted.safeguarding_records
      (student_id, source, occurred_at, factual_record, status, created_by, created_by_role)
    values (${studentId}, 'teacher_observation',
            ${occurredOn ? new Date(occurredOn).toISOString() : sql`now()`},
            ${factual.slice(0, 4000)}, 'open', ${user.id}, ${user.role}::core.user_role)
  `);
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "safeguarding_referral_created",
    entityType: "student",
    entityId: studentId,
    details: { source: "teacher_observation" },
  });
  revalidatePath(`/teacher/students/${studentId}`);
  redirect(`/teacher/students/${studentId}?referred=1`);
}
