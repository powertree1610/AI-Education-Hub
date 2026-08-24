"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_USER_COOKIE } from "@/lib/auth";
import { authMode } from "@/lib/env";

export async function devLoginAction(formData: FormData) {
  if (authMode() === "clerk") redirect("/sign-in");
  const email = String(formData.get("email") ?? "");
  const cookieStore = await cookies();
  cookieStore.set(DEV_USER_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function devLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_USER_COOKIE);
  redirect("/dev-login");
}
