"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, writeAudit } from "@platform/shared";
import { requireAppUser, type AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Goal lifecycle (v5). Anyone may PROPOSE a goal (parent action, intake
 * forms, MCP suggest_goal) — only a teacher/admin moves it through the
 * lifecycle. Progress notes are append-only rows in goal_updates.
 *
 * Legal transitions: proposed → active | discontinued(declined)
 *                    active   → improving | achieved | discontinued
 *                    improving→ achieved | active | discontinued
 */

type GoalStatus = (typeof s.goalStatusInCore.enumValues)[number];

const TRANSITIONS: Record<string, readonly GoalStatus[]> = {
  proposed: ["active", "discontinued"],
  active: ["improving", "achieved", "discontinued"],
  improving: ["achieved", "active", "discontinued"],
};

async function loadGoalForStaff(user: AppUser, goalId: string) {
  const db = getDb();
  const goal = (await db.select().from(s.goals).where(eq(s.goals.id, goalId)).limit(1))[0];
  if (!goal) throw new Error("Goal not found");
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId: goal.studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }
  return goal;
}

export async function activateGoalAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const goalId = String(formData.get("goalId") ?? "");
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const goal = await loadGoalForStaff(user, goalId);
  if (goal.status !== "proposed") throw new Error("Only a proposed goal can be activated");

  const db = getDb();
  await db
    .update(s.goals)
    .set({
      status: "active",
      startDate: goal.startDate ?? new Date().toISOString().slice(0, 10),
      targetDate: targetDate || goal.targetDate,
    })
    .where(eq(s.goals.id, goalId));
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "goal_activated",
    entityType: "goal",
    entityId: goalId,
  });
  revalidatePath(`/teacher/students/${goal.studentId}`);
}

export async function declineGoalAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const goalId = String(formData.get("goalId") ?? "");
  const goal = await loadGoalForStaff(user, goalId);
  if (goal.status !== "proposed") throw new Error("Only a proposed goal can be declined");

  const db = getDb();
  await db.update(s.goals).set({ status: "discontinued" }).where(eq(s.goals.id, goalId));
  await db.insert(s.goalUpdates).values({
    goalId,
    note: "Declined at proposal stage.",
    updatedBy: user.id,
  });
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "goal_declined",
    entityType: "goal",
    entityId: goalId,
  });
  revalidatePath(`/teacher/students/${goal.studentId}`);
}

export async function setGoalStatusAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const goalId = String(formData.get("goalId") ?? "");
  const next = String(formData.get("status") ?? "") as GoalStatus;
  const goal = await loadGoalForStaff(user, goalId);

  const legal = TRANSITIONS[goal.status] ?? [];
  if (!legal.includes(next)) {
    throw new Error(`Cannot move a ${goal.status} goal to ${next}`);
  }

  const db = getDb();
  await db.update(s.goals).set({ status: next }).where(eq(s.goals.id, goalId));
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "goal_status_changed",
    entityType: "goal",
    entityId: goalId,
    details: { from: goal.status, to: next },
  });
  revalidatePath(`/teacher/students/${goal.studentId}`);
}

/** Append a progress note. progress = 0-100 percent (optional). */
export async function addGoalUpdateAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const goalId = String(formData.get("goalId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const progressRaw = String(formData.get("progress") ?? "").trim();
  if (!note) throw new Error("A progress note is required");
  const progress = progressRaw === "" ? null : Math.round(Number(progressRaw));
  if (progress !== null && (Number.isNaN(progress) || progress < 0 || progress > 100)) {
    throw new Error("Progress must be 0-100");
  }
  const goal = await loadGoalForStaff(user, goalId);

  const db = getDb();
  await db.insert(s.goalUpdates).values({ goalId, note: note.slice(0, 2000), progress, updatedBy: user.id });
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "goal_update_added",
    entityType: "goal",
    entityId: goalId,
    details: progress === null ? {} : { progress },
  });
  revalidatePath(`/teacher/students/${goal.studentId}`);
}
