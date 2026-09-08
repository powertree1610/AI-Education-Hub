import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { getDb } from "./db";

/** The student record behind a signed-in student account (v5 Home Mode).
 *  null = the users row exists but no student is linked yet. */
export const studentForUser = cache(async (userId: string) => {
  const rows = await getDb().select().from(s.students).where(eq(s.students.userId, userId)).limit(1);
  return rows[0] ?? null;
});
