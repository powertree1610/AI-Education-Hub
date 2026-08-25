import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { currentAppUser, requireAppUser, type AppUser } from "./auth";
import { getDb } from "./db";
import { authMode } from "./env";

export function signInPath(): string {
  return authMode() === "dev" ? "/dev-login" : "/sign-in";
}

/** For route-group layouts: redirect when unauthenticated or wrong role. */
export async function requireRoleOrRedirect(...roles: AppUser["role"][]): Promise<AppUser> {
  const user = await currentAppUser();
  if (!user) redirect(signInPath());
  if (roles.length > 0 && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Safeguarding lead is a flag on a staff account, not a role (design §4).
 *  cache() dedupes the lookup within one request (layout + page both ask). */
export const isSafeguardingLead = cache(async (userId: string): Promise<boolean> => {
  const rows = await getDb()
    .select({ lead: s.staffProfiles.isSafeguardingLead })
    .from(s.staffProfiles)
    .where(eq(s.staffProfiles.userId, userId))
    .limit(1);
  return rows[0]?.lead === true;
});

/** For safeguarding module PAGES (redirect-flavoured): any role, but ONLY
 *  the flagged lead — an unflagged admin is turned away too. Every page in
 *  (lead)/ must call this itself; the layout alone is not a security
 *  boundary (it does not re-run on soft navigation). */
export async function requireSafeguardingLead(): Promise<AppUser> {
  const user = await currentAppUser();
  if (!user) redirect(signInPath());
  if (!(await isSafeguardingLead(user.id))) redirect("/");
  return user;
}

/** For safeguarding server ACTIONS (throw-flavoured): same rule as above. */
export async function requireSafeguardingLeadOrThrow(): Promise<AppUser> {
  const user = await requireAppUser();
  if (!(await isSafeguardingLead(user.id))) throw new Error("Safeguarding lead access required");
  return user;
}

/** Landing route for a signed-in user's role. */
export function homePathFor(role: AppUser["role"]): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "guardian":
      return "/parent";
    case "student":
      return "/student";
  }
}
