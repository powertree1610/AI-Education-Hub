"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, writeAudit } from "@platform/shared";
import { requireAppUser, type AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Intake questionnaires (M3): each submission stores the raw answers as a
 * versioned form_submissions row (audit) AND extracts checkbox/rating answers
 * into the normalized tables (academic_assessments, trait_observations,
 * student_interests, goals) tagged with their source — one transaction.
 * Re-submitting later is fine: history is kept, sources never merge.
 */

type Rating = (typeof s.assessmentRatingInCore.enumValues)[number];

function collectPayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$") || key === "studentId") continue;
    if (typeof value === "string" && value.trim()) payload[key] = value.trim();
  }
  return payload;
}

async function loadRefs(db: ReturnType<typeof getDb>) {
  const subjects = await db.select().from(s.subjects);
  const traits = await db.select().from(s.traits);
  const interests = await db.select().from(s.interests);
  return { subjects, traits, interests };
}

function extractRatings(formData: FormData, subjects: { id: string }[]): { subjectId: string; rating: Rating; notes: string | null }[] {
  const out: { subjectId: string; rating: Rating; notes: string | null }[] = [];
  for (const subject of subjects) {
    const rating = String(formData.get(`rating_${subject.id}`) ?? "");
    if (!s.assessmentRatingInCore.enumValues.includes(rating as Rating)) continue;
    const notes = String(formData.get(`note_${subject.id}`) ?? "").trim() || null;
    out.push({ subjectId: subject.id, rating: rating as Rating, notes });
  }
  return out;
}

function extractTraits(
  formData: FormData,
  traits: { id: string; valueType: "checkbox" | "scale_1_5" }[],
): { traitId: string; value: string }[] {
  const out: { traitId: string; value: string }[] = [];
  for (const trait of traits) {
    const raw = String(formData.get(`trait_${trait.id}`) ?? "").trim();
    if (!raw) continue;
    if (trait.valueType === "checkbox" && raw === "on") out.push({ traitId: trait.id, value: "true" });
    if (trait.valueType === "scale_1_5" && /^[1-5]$/.test(raw)) out.push({ traitId: trait.id, value: raw });
  }
  return out;
}

function extractInterests(
  formData: FormData,
  interests: { id: string }[],
): { interestId: string | null; freeText: string | null }[] {
  const out: { interestId: string | null; freeText: string | null }[] = [];
  for (const interest of interests) {
    if (formData.get(`interest_${interest.id}`) === "on") out.push({ interestId: interest.id, freeText: null });
  }
  const free = String(formData.get("freeInterests") ?? "").trim();
  for (const text of free.split(",").map((x) => x.trim()).filter(Boolean)) {
    out.push({ interestId: null, freeText: text.slice(0, 100) });
  }
  return out;
}

async function guardTeacherAccess(user: AppUser, studentId: string) {
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(getDb(), {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }
}

/** Parent questionnaire — keyed in by an admin from the signed paper form
 *  (the parent portal will reuse this action later). */
export async function submitParentQuestionnaireAction(formData: FormData) {
  const user = await requireAppUser("admin");
  const db = getDb();
  const studentId = String(formData.get("studentId") ?? "");

  const { subjects, traits, interests } = await loadRefs(db);
  const ratings = extractRatings(formData, subjects);
  const traitValues = extractTraits(formData, traits);
  const interestRows = extractInterests(formData, interests);
  const goalText = String(formData.get("goalText") ?? "").trim();

  await db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(s.formSubmissions)
      .values({
        studentId,
        formType: "parent_questionnaire",
        submittedBy: user.id,
        payload: collectPayload(formData),
        schemaVersion: 1,
      })
      .returning({ id: s.formSubmissions.id });

    if (ratings.length) {
      await tx.insert(s.academicAssessments).values(
        ratings.map((r) => ({
          studentId,
          subjectId: r.subjectId,
          assessorRole: "parent" as const,
          rating: r.rating,
          notes: r.notes,
          formSubmissionId: submission!.id,
        })),
      );
    }
    if (traitValues.length) {
      await tx.insert(s.traitObservations).values(
        traitValues.map((t) => ({
          studentId,
          traitId: t.traitId,
          value: t.value,
          source: "parent" as const,
          context: "home" as const,
          formSubmissionId: submission!.id,
        })),
      );
    }
    if (interestRows.length) {
      await tx.insert(s.studentInterests).values(
        interestRows.map((i) => ({
          studentId,
          interestId: i.interestId,
          kind: "interest" as const,
          freeText: i.freeText,
          source: "parent" as const,
        })),
      );
    }
    if (goalText) {
      await tx.insert(s.goals).values({
        studentId,
        goalType: "personal",
        title: goalText.slice(0, 200),
        requestedByRole: "parent",
        status: "proposed",
      });
    }
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "submitted_parent_questionnaire",
    entityType: "student",
    entityId: studentId,
    details: { ratings: ratings.length, traits: traitValues.length, interests: interestRows.length },
  });

  redirect(`/admin/students/${studentId}`);
}

/** The Part G/K development areas offered on the baseline form. */
const BASELINE_DEV_AREAS = ["confidence", "concentration", "resilience", "independence", "motivation"];

/** Teacher baseline — per-subject view, traits at the centre, and optional
 *  initial 1–5 levels (teacher-set, so they apply directly to student_levels). */
export async function submitTeacherBaselineAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();
  const studentId = String(formData.get("studentId") ?? "");
  await guardTeacherAccess(user, studentId);

  const { subjects, traits } = await loadRefs(db);
  const ratings = extractRatings(formData, subjects);
  const traitValues = extractTraits(formData, traits);
  const goalText = String(formData.get("goalText") ?? "").trim();

  const levels: { kind: "academic_skill" | "development_area"; key: string; subjectId: string | null; score: number }[] = [];
  for (const subject of subjects) {
    const raw = String(formData.get(`skill_${subject.id}`) ?? "");
    if (/^[1-5]$/.test(raw)) {
      levels.push({
        kind: "academic_skill",
        key: `${subject.code.toLowerCase()}_overall`,
        subjectId: subject.id,
        score: Number(raw),
      });
    }
  }
  for (const key of BASELINE_DEV_AREAS) {
    const raw = String(formData.get(`level_${key}`) ?? "");
    if (/^[1-5]$/.test(raw)) levels.push({ kind: "development_area", key, subjectId: null, score: Number(raw) });
  }

  await db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(s.formSubmissions)
      .values({
        studentId,
        formType: "teacher_baseline",
        submittedBy: user.id,
        payload: collectPayload(formData),
        schemaVersion: 1,
      })
      .returning({ id: s.formSubmissions.id });

    if (ratings.length) {
      await tx.insert(s.academicAssessments).values(
        ratings.map((r) => ({
          studentId,
          subjectId: r.subjectId,
          assessorRole: "teacher" as const,
          assessorId: user.id,
          rating: r.rating,
          notes: r.notes,
          formSubmissionId: submission!.id,
        })),
      );
    }
    if (traitValues.length) {
      await tx.insert(s.traitObservations).values(
        traitValues.map((t) => ({
          studentId,
          traitId: t.traitId,
          value: t.value,
          source: "teacher" as const,
          context: "centre" as const,
          formSubmissionId: submission!.id,
        })),
      );
    }
    // Teacher-set baseline levels write straight to the live profile — the
    // teacher IS the approver (append-only history, set_by_user_id).
    if (levels.length) {
      await tx.insert(s.studentLevels).values(
        levels.map((l) => ({
          studentId,
          kind: l.kind,
          key: l.key,
          subjectId: l.subjectId,
          score: l.score,
          setByUserId: user.id,
        })),
      );
    }
    if (goalText) {
      await tx.insert(s.goals).values({
        studentId,
        goalType: "academic",
        title: goalText.slice(0, 200),
        requestedByRole: "teacher",
        requestedByUser: user.id,
        status: "active",
        startDate: new Date().toISOString().slice(0, 10),
      });
    }
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "submitted_teacher_baseline",
    entityType: "student",
    entityId: studentId,
    details: { ratings: ratings.length, levels: levels.length },
  });

  redirect(`/teacher/students/${studentId}`);
}

/** Student interview ("student voice") — teacher-guided, kid-friendly wording. */
export async function submitStudentInterviewAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();
  const studentId = String(formData.get("studentId") ?? "");
  await guardTeacherAccess(user, studentId);

  const { interests } = await loadRefs(db);
  const interestRows = extractInterests(formData, interests);
  const favourites: { kind: "favourite_game" | "favourite_character" | "favourite_topic"; text: string }[] = [];
  for (const kind of ["favourite_game", "favourite_character", "favourite_topic"] as const) {
    const text = String(formData.get(kind) ?? "").trim();
    if (text) favourites.push({ kind, text: text.slice(0, 100) });
  }
  const improveText = String(formData.get("wantToImprove") ?? "").trim();

  await db.transaction(async (tx) => {
    await tx.insert(s.formSubmissions).values({
      studentId,
      formType: "student_interview",
      submittedBy: user.id,
      payload: collectPayload(formData),
      schemaVersion: 1,
    });

    const allInterests = [
      ...interestRows.map((i) => ({ interestId: i.interestId, kind: "interest" as const, freeText: i.freeText })),
      ...favourites.map((f) => ({ interestId: null, kind: f.kind, freeText: f.text })),
    ];
    if (allInterests.length) {
      await tx.insert(s.studentInterests).values(
        allInterests.map((i) => ({
          studentId,
          interestId: i.interestId,
          kind: i.kind,
          freeText: i.freeText,
          source: "student" as const,
        })),
      );
    }
    if (improveText) {
      await tx.insert(s.goals).values({
        studentId,
        goalType: "personal",
        title: improveText.slice(0, 200),
        requestedByRole: "student",
        status: "proposed",
      });
    }
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "submitted_student_interview",
    entityType: "student",
    entityId: studentId,
    details: { interests: interestRows.length + favourites.length },
  });

  redirect(`/teacher/students/${studentId}`);
}
