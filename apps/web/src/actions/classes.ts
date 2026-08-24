"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function createClassAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const name = str(formData, "name");
  if (!name) throw new Error("Class name is required");
  const branch = (await db.select().from(s.branches).limit(1))[0];
  if (!branch) throw new Error("No branch exists — run the seed first");

  const [cls] = await db
    .insert(s.classes)
    .values({ branchId: branch.id, name, programme: str(formData, "programme") || null })
    .returning({ id: s.classes.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "created_class",
    entityType: "class",
    entityId: cls!.id,
    details: { name },
  });

  redirect(`/admin/classes/${cls!.id}`);
}

export async function enrollStudentAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const classId = str(formData, "classId");
  const studentId = str(formData, "studentId");
  if (!classId || !studentId) throw new Error("classId and studentId required");

  const existing = await db
    .select({ id: s.classEnrollments.id })
    .from(s.classEnrollments)
    .where(
      and(
        eq(s.classEnrollments.classId, classId),
        eq(s.classEnrollments.studentId, studentId),
        isNull(s.classEnrollments.endDate),
      ),
    )
    .limit(1);
  if (existing[0]) throw new Error("Student is already enrolled in this class");

  await db.insert(s.classEnrollments).values({
    classId,
    studentId,
    startDate: new Date().toISOString().slice(0, 10),
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "enrolled_student",
    entityType: "class",
    entityId: classId,
    details: { studentId },
  });

  revalidatePath(`/admin/classes/${classId}`);
}

export async function endEnrollmentAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const enrollmentId = str(formData, "enrollmentId");

  const [row] = await db
    .update(s.classEnrollments)
    .set({ endDate: new Date().toISOString().slice(0, 10) })
    .where(and(eq(s.classEnrollments.id, enrollmentId), isNull(s.classEnrollments.endDate)))
    .returning({ classId: s.classEnrollments.classId, studentId: s.classEnrollments.studentId });
  if (!row) throw new Error("Active enrollment not found");

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "ended_enrollment",
    entityType: "class",
    entityId: row.classId,
    details: { studentId: row.studentId },
  });

  revalidatePath(`/admin/classes/${row.classId}`);
}

export async function assignClassTeacherAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const classId = str(formData, "classId");
  const userId = str(formData, "userId");
  const role = (str(formData, "role") || "primary") as "primary" | "support";

  await db
    .insert(s.classTeachers)
    .values({ classId, userId, role })
    .onConflictDoNothing();

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "assigned_class_teacher",
    entityType: "class",
    entityId: classId,
    details: { userId, role },
  });

  revalidatePath(`/admin/classes/${classId}`);
}

export async function removeClassTeacherAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const id = str(formData, "classTeacherId");

  const [row] = await db
    .delete(s.classTeachers)
    .where(eq(s.classTeachers.id, id))
    .returning({ classId: s.classTeachers.classId, userId: s.classTeachers.userId });
  if (!row) throw new Error("Assignment not found");

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "removed_class_teacher",
    entityType: "class",
    entityId: row.classId,
    details: { userId: row.userId },
  });

  revalidatePath(`/admin/classes/${row.classId}`);
}

/** Direct one-to-one teacher link (student_teachers) — no class involved. */
export async function linkStudentTeacherAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const studentId = str(formData, "studentId");
  const userId = str(formData, "userId");
  const role = (str(formData, "role") || "tutor") as
    | "form_teacher"
    | "tutor"
    | "mentor"
    | "support";
  const subjectId = str(formData, "subjectId") || null;

  await db
    .insert(s.studentTeachers)
    .values({ studentId, userId, role, subjectId })
    .onConflictDoNothing();

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "linked_student_teacher",
    entityType: "student",
    entityId: studentId,
    details: { userId, role },
  });

  revalidatePath(`/admin/students/${studentId}`);
}

export async function endStudentTeacherAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const id = str(formData, "studentTeacherId");

  const [row] = await db
    .update(s.studentTeachers)
    .set({ endDate: new Date().toISOString().slice(0, 10) })
    .where(and(eq(s.studentTeachers.id, id), isNull(s.studentTeachers.endDate)))
    .returning({ studentId: s.studentTeachers.studentId, userId: s.studentTeachers.userId });
  if (!row) throw new Error("Active link not found");

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "ended_student_teacher",
    entityType: "student",
    entityId: row.studentId,
    details: { userId: row.userId },
  });

  revalidatePath(`/admin/students/${row.studentId}`);
}
