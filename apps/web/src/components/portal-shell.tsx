import Link from "next/link";
import type { AppUser } from "@/lib/auth";
import { authMode } from "@/lib/env";
import { devLogoutAction } from "@/app/dev-login/actions";

export function PortalShell({
  title,
  nav,
  user,
  children,
}: {
  title: string;
  nav: { href: string; label: string }[];
  user: AppUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{title}</span>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              {user.name} · {user.role}
            </span>
            {authMode() === "dev" ? (
              <form action={devLogoutAction}>
                <button type="submit" className="text-slate-400 underline hover:text-slate-600">
                  switch user
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
