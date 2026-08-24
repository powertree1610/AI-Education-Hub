import "server-only";
import { and, eq } from "drizzle-orm";
import { schema as s, type Db } from "@platform/db";

/** The guardians row belonging to a signed-in portal user (role guardian). */
export async function guardianOfUser(db: Db, userId: string) {
  const rows = await db.select().from(s.guardians).where(eq(s.guardians.userId, userId)).limit(1);
  return rows[0] ?? null;
}

/** Children linked to a guardian portal user via student_guardians. */
export async function listChildrenOfGuardianUser(db: Db, userId: string) {
  return db
    .select({
      id: s.students.id,
      fullName: s.students.fullName,
      preferredName: s.students.preferredName,
      studentCode: s.students.studentCode,
      schoolGrade: s.students.schoolGrade,
      status: s.students.status,
      relationship: s.studentGuardians.relationship,
      guardianId: s.guardians.id,
    })
    .from(s.guardians)
    .innerJoin(s.studentGuardians, eq(s.studentGuardians.guardianId, s.guardians.id))
    .innerJoin(s.students, eq(s.students.id, s.studentGuardians.studentId))
    .where(eq(s.guardians.userId, userId));
}

/** "May this portal user see this child?" — own children only, ever. */
export async function isChildOfGuardianUser(
  db: Db,
  userId: string,
  studentId: string,
): Promise<{ ok: boolean; guardianId: string | null }> {
  const rows = await db
    .select({ guardianId: s.guardians.id })
    .from(s.guardians)
    .innerJoin(s.studentGuardians, eq(s.studentGuardians.guardianId, s.guardians.id))
    .where(and(eq(s.guardians.userId, userId), eq(s.studentGuardians.studentId, studentId)))
    .limit(1);
  return { ok: rows.length > 0, guardianId: rows[0]?.guardianId ?? null };
}
