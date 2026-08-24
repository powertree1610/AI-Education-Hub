"use server";

import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function addResultAction(formData: FormData) {
  const user = await requireAppUser("admin", "teacher");
  const db = getDb();

  const studentId = str(formData, "studentId");
  const subjectId = str(formData, "subjectId");
  const assessmentType = str(formData, "assessmentType");
  const assessmentDate = str(formData, "assessmentDate");
  if (!studentId || !subjectId || !assessmentType || !assessmentDate) {
    throw new Error("Subject, assessment type and date are required");
  }

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }

  const scoreRaw = str(formData, "score");
  const maxScoreRaw = str(formData, "maxScore");
  const positionRaw = str(formData, "classPosition");

  const [row] = await db
    .insert(s.academicResults)
    .values({
      studentId,
      subjectId,
      assessmentType,
      assessmentDate,
      schoolYear: str(formData, "schoolYear") || null,
      term: str(formData, "term") || null,
      score: scoreRaw ? scoreRaw : null,
      maxScore: maxScoreRaw ? maxScoreRaw : null,
      grade: str(formData, "grade") || null,
      classPosition: positionRaw ? Number(positionRaw) : null,
      teacherComment: str(formData, "teacherComment") || null,
      source: (str(formData, "source") || "school") as "school" | "centre",
      enteredBy: user.id,
    })
    .returning({ id: s.academicResults.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "entered_result",
    entityType: "academic_result",
    entityId: row!.id,
    details: { studentId, assessmentType },
  });

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/teacher/students/${studentId}`);
}
