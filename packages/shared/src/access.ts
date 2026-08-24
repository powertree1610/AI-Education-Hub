import { and, eq } from "drizzle-orm";
import { schema as s, type Db } from "@platform/db";

export type StaffRole = "admin" | "teacher";

/**
 * "May this user open this child's record?"
 * Admin: yes (operational data). Teacher: only via v_student_access
 * (current class assignment or direct one-to-one link).
 */
export async function canUserAccessStudent(
  db: Db,
  args: { userId: string; role: StaffRole; studentId: string },
): Promise<boolean> {
  if (args.role === "admin") return true;
  const rows = await db
    .select({ studentId: s.vStudentAccess.studentId })
    .from(s.vStudentAccess)
    .where(and(eq(s.vStudentAccess.userId, args.userId), eq(s.vStudentAccess.studentId, args.studentId)))
    .limit(1);
  return rows.length > 0;
}

/** Student ids a teacher can reach (admins should not use this — they see all). */
export async function listAccessibleStudentIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: s.vStudentAccess.studentId })
    .from(s.vStudentAccess)
    .where(eq(s.vStudentAccess.userId, userId));
  return rows.map((r) => r.studentId).filter((id): id is string => id !== null);
}
