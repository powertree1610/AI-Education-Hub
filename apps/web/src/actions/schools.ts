"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Schools master (v5) — dedupe is case-insensitive via the lower(name)
 *  unique index; conflicts surface as a friendly message. */

export async function createSchoolAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("School name is required");

  const db = getDb();
  try {
    const [school] = await db
      .insert(s.schools)
      .values({
        name: name.slice(0, 200),
        schoolType: String(formData.get("schoolType") ?? "").trim() || null,
        curriculum: String(formData.get("curriculum") ?? "").trim() || null,
      })
      .returning({ id: s.schools.id });
    await writeAudit(db, {
      actorType: "user",
      actorId: admin.id,
      action: "created_school",
      entityType: "school",
      entityId: school!.id,
      details: { name },
    });
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") {
      throw new Error("That school already exists");
    }
    throw err;
  }
  revalidatePath("/admin/schools");
}

export async function updateSchoolAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const schoolId = String(formData.get("schoolId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const isActive = formData.get("isActive") !== "false";
  if (name.length < 2) throw new Error("School name is required");

  const db = getDb();
  try {
    await db
      .update(s.schools)
      .set({
        name: name.slice(0, 200),
        schoolType: String(formData.get("schoolType") ?? "").trim() || null,
        curriculum: String(formData.get("curriculum") ?? "").trim() || null,
        isActive,
      })
      .where(eq(s.schools.id, schoolId));
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") {
      throw new Error("Another school already has that name");
    }
    throw err;
  }
  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "updated_school",
    entityType: "school",
    entityId: schoolId,
    details: { name, isActive },
  });
  revalidatePath("/admin/schools");
}

/** Insert-or-fetch by case-insensitive name — used by student registration. */
export async function schoolIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = getDb();
  const existing = await db
    .select({ id: s.schools.id })
    .from(s.schools)
    .where(sql`lower(${s.schools.name}) = ${trimmed.toLowerCase()}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(s.schools)
    .values({ name: trimmed.slice(0, 200) })
    .onConflictDoNothing()
    .returning({ id: s.schools.id });
  if (created) return created.id;
  // Lost a race — fetch the winner.
  const again = await db
    .select({ id: s.schools.id })
    .from(s.schools)
    .where(sql`lower(${s.schools.name}) = ${trimmed.toLowerCase()}`)
    .limit(1);
  return again[0]?.id ?? null;
}
