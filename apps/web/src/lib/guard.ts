import "server-only";
import { redirect } from "next/navigation";
import { currentAppUser, type AppUser } from "./auth";
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
