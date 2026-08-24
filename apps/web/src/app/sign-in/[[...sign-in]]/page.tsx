import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { authMode } from "@/lib/env";

export default function SignInPage() {
  if (authMode() !== "clerk") redirect("/dev-login");
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
