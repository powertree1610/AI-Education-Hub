import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema as s } from "@platform/db";
import { getDb } from "@/lib/db";
import { authMode } from "@/lib/env";
import { devLoginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  if (authMode() === "clerk") redirect("/sign-in");

  const users = await getDb()
    .select({ email: s.users.email, name: s.users.name, role: s.users.role })
    .from(s.users)
    .where(eq(s.users.isActive, true));
  const loginable = users.filter((u) => u.email);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Dev sign-in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clerk keys are not configured — pick a seeded user. This page is
          disabled once Clerk is set up.
        </p>
        <ul className="mt-4 space-y-2">
          {loginable.map((u) => (
            <li key={u.email}>
              <form action={devLoginAction}>
                <input type="hidden" name="email" value={u.email!} />
                <button
                  type="submit"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium">{u.name}</span>{" "}
                  <span className="text-slate-500">
                    · {u.role} · {u.email}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
