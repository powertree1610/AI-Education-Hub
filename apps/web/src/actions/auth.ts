"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function credentialsSignInAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/sign-in?error=1");
    }
    throw err; // NEXT_REDIRECT from a successful sign-in passes through here
  }
}

export async function localSignOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
