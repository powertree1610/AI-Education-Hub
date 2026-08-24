"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, writeAudit, type ProposedChange } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Part G/K development areas — everything else defaults to academic_skill. */
const DEVELOPMENT_KEYS = new Set([
  "confidence",
  "concentration",
  "resilience",
  "independence",
  "social_skills",
  "communication",
  "emotional_regulation",
  "motivation",
  "responsibility",
  "creativity",
]);

async function guardStudentAccess(userId: string, role: "admin" | "teacher", studentId: string) {
  if (role === "admin") return;
  const allowed = await canUserAccessStudent(getDb(), { userId, role: "teacher", studentId });
  if (!allowed) throw new Error("You are not assigned to this student");
}

export async function reviewWorkAnalysisAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const analysisId = String(formData.get("analysisId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["confirmed", "partial", "rejected"].includes(decision)) throw new Error("Invalid decision");

  const row = (
    await db
      .select({ id: s.workAnalyses.id, studentId: s.workSamples.studentId })
      .from(s.workAnalyses)
      .innerJoin(s.workSamples, eq(s.workSamples.id, s.workAnalyses.workSampleId))
      .where(and(eq(s.workAnalyses.id, analysisId), eq(s.workAnalyses.reviewStatus, "pending_review")))
      .limit(1)
  )[0];
  if (!row) throw new Error("Pending analysis not found");
  await guardStudentAccess(user.id, user.role as "admin" | "teacher", row.studentId);

  await db
    .update(s.workAnalyses)
    .set({
      reviewStatus: decision as "confirmed" | "partial" | "rejected",
      reviewedBy: user.id,
      reviewerNotes: String(formData.get("notes") ?? "").trim() || null,
    })
    .where(eq(s.workAnalyses.id, analysisId));

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "reviewed_work_analysis",
    entityType: "work_analysis",
    entityId: analysisId,
    details: { decision },
  });

  revalidatePath("/teacher/review");
}

export async function reviewObservationAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const observationId = String(formData.get("observationId") ?? "");
  const decision = String(formData.get("decision") ?? "") as
    | "approved"
    | "partially_approved"
    | "rejected"
    | "monitoring";
  if (!["approved", "partially_approved", "rejected", "monitoring"].includes(decision)) {
    throw new Error("Invalid decision");
  }
  const comments = String(formData.get("comments") ?? "").trim() || null;

  const observation = (
    await db
      .select()
      .from(s.observations)
      .where(and(eq(s.observations.id, observationId), eq(s.observations.status, "unverified")))
      .limit(1)
  )[0];
  if (!observation) throw new Error("Unverified observation not found");
  await guardStudentAccess(user.id, user.role as "admin" | "teacher", observation.studentId);

  // The approval workflow (design §8.4): review + status + (on approval)
  // profile application + audit — all one transaction.
  await db.transaction(async (tx) => {
    await tx.insert(s.observationReviews).values({
      observationId,
      reviewerId: user.id,
      decision,
      comments,
    });

    await tx
      .update(s.observations)
      .set({ status: decision === "monitoring" ? "monitoring" : decision })
      .where(eq(s.observations.id, observationId));

    const change = observation.proposedChange as ProposedChange | null;
    const applies = decision === "approved" || decision === "partially_approved";
    if (applies && change?.target === "student_levels" && change.key && change.to !== undefined) {
      const score = Number(change.to);
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error(`Proposed level ${change.to} is not a valid 1–5 score`);
      }

      // Inherit the kind from the student's existing level history when
      // present; otherwise classify by the known development-area keys.
      const existing = await tx
        .select({ kind: s.studentLevels.kind })
        .from(s.studentLevels)
        .where(
          and(eq(s.studentLevels.studentId, observation.studentId), eq(s.studentLevels.key, change.key)),
        )
        .orderBy(desc(s.studentLevels.effectiveFrom))
        .limit(1);
      const kind =
        existing[0]?.kind ??
        (DEVELOPMENT_KEYS.has(change.key) ? ("development_area" as const) : ("academic_skill" as const));

      const [level] = await tx
        .insert(s.studentLevels)
        .values({
          studentId: observation.studentId,
          kind,
          key: change.key,
          score,
          setByObservationId: observationId,
        })
        .returning({ id: s.studentLevels.id });

      // Sparse details only — field, old and new values, never the whole row.
      await tx.insert(s.auditLog).values({
        actorType: "user",
        actorId: user.id,
        action: "approved_level_change",
        entityType: "student_level",
        entityId: level!.id,
        details: { key: change.key, from: change.from ?? null, to: score, via_observation: observationId },
      });
    }

    await tx.insert(s.auditLog).values({
      actorType: "user",
      actorId: user.id,
      action: "reviewed_observation",
      entityType: "observation",
      entityId: observationId,
      details: { decision },
    });
  });

  revalidatePath("/teacher/review");
}
