import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import type { Db } from "@platform/db";

export async function subjectIdByCode(db: Db, code: string): Promise<string | null> {
  const rows = await db
    .select({ id: s.subjects.id })
    .from(s.subjects)
    .where(eq(s.subjects.code, code.toUpperCase()))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function studentIdOfWorkSample(db: Db, workSampleId: string): Promise<string | null> {
  const rows = await db
    .select({ studentId: s.workSamples.studentId })
    .from(s.workSamples)
    .where(eq(s.workSamples.id, workSampleId))
    .limit(1);
  return rows[0]?.studentId ?? null;
}
