import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { schema as s } from "@platform/db";
import { getDb } from "./db";
import { authMode } from "./env";

export interface AppUser {
  id: string;
  role: "admin" | "teacher" | "guardian" | "student";
  name: string;
  email: string | null;
}

export const DEV_USER_COOKIE = "dev-user-email";

function toAppUser(row: typeof s.users.$inferSelect): AppUser {
  return { id: row.id, role: row.role, name: row.name, email: row.email ?? null };
}

/**
 * Resolve the signed-in core.users row.
 *
 * Clerk mode (JIT sync — no public webhook URL on the IIS box):
 *   1. users.auth_identity = Clerk user id → done.
 *   2. Otherwise match the Clerk email against an admin-pre-provisioned users
 *      row with no auth_identity yet, and backfill auth_identity (first login).
 *   3. No match → null (unprovisioned account; UI shows "ask your admin").
 *
 * Dev mode (no Clerk keys configured): the dev-user-email cookie set by
 * /dev-login selects a seeded user. Never active once Clerk keys exist.
 */
export async function currentAppUser(): Promise<AppUser | null> {
  const db = getDb();

  if (authMode() === "clerk") {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return null;

    const byIdentity = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.authIdentity, userId), eq(s.users.isActive, true)))
      .limit(1);
    if (byIdentity[0]) return toAppUser(byIdentity[0]);

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    if (!email) return null;

    const byEmail = await db
      .select()
      .from(s.users)
      .where(and(eq(s.users.email, email), isNull(s.users.authIdentity), eq(s.users.isActive, true)))
      .limit(1);
    if (!byEmail[0]) return null;

    await db.update(s.users).set({ authIdentity: userId }).where(eq(s.users.id, byEmail[0].id));
    return toAppUser(byEmail[0]);
  }

  // dev mode
  const cookieStore = await cookies();
  const email = cookieStore.get(DEV_USER_COOKIE)?.value;
  if (!email) return null;
  const rows = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.email, email), eq(s.users.isActive, true)))
    .limit(1);
  return rows[0] ? toAppUser(rows[0]) : null;
}

/** Like currentAppUser but throws — for server actions/APIs that require auth. */
export async function requireAppUser(...roles: AppUser["role"][]): Promise<AppUser> {
  const user = await currentAppUser();
  if (!user) throw new Error("Not signed in");
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new Error(`Requires role: ${roles.join(" or ")}`);
  }
  return user;
}
