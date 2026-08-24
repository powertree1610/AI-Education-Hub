"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { CONSENT_TYPES, writeAudit, type ConsentType } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isChildOfGuardianUser } from "@/lib/parents";

/** Admin: give a guardian a portal login (users row, role guardian).
 *  Password is then set on /admin/users like any other user. */
export async function enableGuardianPortalAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();
  const guardianId = String(formData.get("guardianId") ?? "");

  const guardian = (
    await db.select().from(s.guardians).where(eq(s.guardians.id, guardianId)).limit(1)
  )[0];
  if (!guardian) throw new Error("Guardian not found");
  if (guardian.userId) throw new Error("Guardian already has portal access");
  if (!guardian.email) throw new Error("Guardian has no email on record — add one first");

  const [user] = await db
    .insert(s.users)
    .values({ name: guardian.name, email: guardian.email.toLowerCase(), role: "guardian" })
    .returning({ id: s.users.id });
  await db.update(s.guardians).set({ userId: user!.id }).where(eq(s.guardians.id, guardianId));

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "enabled_guardian_portal",
    entityType: "guardian",
    entityId: guardianId,
  });

  revalidatePath("/admin/users");
}

/** Parent: digital consent grant/withdraw for own child (append-only). */
export async function parentSetConsentAction(formData: FormData) {
  const user = await requireAppUser("guardian");
  const db = getDb();

  const studentId = String(formData.get("studentId") ?? "");
  const consentType = String(formData.get("consentType") ?? "") as ConsentType;
  const status = String(formData.get("status") ?? "");
  if (!CONSENT_TYPES.includes(consentType)) throw new Error("Unknown consent type");
  if (status !== "granted" && status !== "withdrawn") throw new Error("Invalid status");

  const { ok, guardianId } = await isChildOfGuardianUser(db, user.id, studentId);
  if (!ok || !guardianId) throw new Error("Not your child");

  await db.insert(s.consents).values({
    studentId,
    guardianId,
    consentType,
    status,
    method: "digital",
    grantedAt: status === "granted" ? new Date().toISOString() : null,
    withdrawnAt: status === "withdrawn" ? new Date().toISOString() : null,
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: status === "granted" ? "recorded_consent" : "withdrew_consent",
    entityType: "consent",
    entityId: studentId,
    details: { type: consentType, method: "digital" },
  });

  revalidatePath(`/parent/children/${studentId}`);
}

/** Parent: propose a goal for own child (status proposed until a teacher activates it). */
export async function parentProposeGoalAction(formData: FormData) {
  const user = await requireAppUser("guardian");
  const db = getDb();

  const studentId = String(formData.get("studentId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Goal title required");

  const { ok } = await isChildOfGuardianUser(db, user.id, studentId);
  if (!ok) throw new Error("Not your child");

  await db.insert(s.goals).values({
    studentId,
    goalType: "personal",
    title: title.slice(0, 200),
    requestedByRole: "parent",
    status: "proposed",
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "proposed_goal",
    entityType: "student",
    entityId: studentId,
  });

  revalidatePath(`/parent/children/${studentId}`);
}
