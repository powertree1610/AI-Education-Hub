"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MIN_PASSWORD_LENGTH = 8;

export async function createStaffUserAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!name || !email) throw new Error("Name and email are required");
  if (role !== "teacher" && role !== "admin") throw new Error("Role must be teacher or admin");

  const [user] = await db
    .insert(s.users)
    .values({ name, email, role })
    .returning({ id: s.users.id });

  if (role === "teacher") {
    const branch = (await db.select().from(s.branches).limit(1))[0];
    if (branch) {
      await db
        .insert(s.staffProfiles)
        .values({ userId: user!.id, branchId: branch.id, position: "Teacher" })
        .onConflictDoNothing({ target: s.staffProfiles.userId });
    }
  }

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "created_user",
    entityType: "user",
    entityId: user!.id,
    details: { role },
  });

  revalidatePath("/admin/users");
}

export async function setPasswordAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const target = (await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  if (!target) throw new Error("User not found");
  if (target.role === "student") throw new Error("Students do not sign in with passwords");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(s.users).set({ passwordHash }).where(eq(s.users.id, userId));

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "set_password",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/users");
}

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (userId === admin.id && !active) throw new Error("You cannot deactivate yourself");

  await db.update(s.users).set({ isActive: active }).where(eq(s.users.id, userId));

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: active ? "activated_user" : "deactivated_user",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/users");
}

/** Designate (or remove) the safeguarding lead flag on a staff account. */
export async function toggleSafeguardingLeadAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const userId = String(formData.get("userId") ?? "");
  const next = formData.get("next") === "true";

  const target = (await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1))[0];
  if (!target || (target.role !== "teacher" && target.role !== "admin")) {
    throw new Error("Safeguarding lead must be a staff account");
  }

  const branch = (await db.select().from(s.branches).limit(1))[0];
  if (!branch) throw new Error("No branch configured");
  await db
    .insert(s.staffProfiles)
    .values({ userId, branchId: branch.id, position: target.role === "admin" ? "Admin" : "Teacher", isSafeguardingLead: next })
    .onConflictDoUpdate({
      target: s.staffProfiles.userId,
      set: { isSafeguardingLead: next },
    });

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "safeguarding_lead_toggled",
    entityType: "user",
    entityId: userId,
    details: { to: next },
  });

  revalidatePath("/admin/users");
}
