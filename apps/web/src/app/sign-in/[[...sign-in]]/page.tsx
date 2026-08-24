import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { credentialsSignInAction } from "@/actions/auth";
import { authMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const mode = authMode();
  if (mode === "dev") redirect("/dev-login");
  if (mode === "clerk") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <SignIn />
      </main>
    );
  }

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Student Platform staff access</p>
        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Wrong email or password. After 5 failed tries, sign-in locks for 5 minutes.
          </p>
        ) : null}
        <form action={credentialsSignInAction} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
