import { localSignOutAction } from "@/actions/auth";
import { BrandMark } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import type { AppUser } from "@/lib/auth";
import { authMode } from "@/lib/env";
import { devLogoutAction } from "@/app/dev-login/actions";

const ROLE_CHIP: Record<string, string> = {
  admin: "bg-teal-50 text-teal-800 border-teal-200",
  teacher: "bg-emerald-50 text-emerald-800 border-emerald-200",
  guardian: "bg-amber-50 text-amber-800 border-amber-200",
  student: "bg-slate-50 text-slate-600 border-slate-200",
};

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
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <BrandMark />
              <span className="font-semibold tracking-tight">Student Platform</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_CHIP[user.role] ?? ROLE_CHIP.student}`}
              >
                {title}
              </span>
            </span>
            <NavLinks items={nav} />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{user.name}</span>
            {authMode() === "dev" ? (
              <form action={devLogoutAction}>
                <button type="submit" className="text-slate-400 underline hover:text-slate-600">
                  switch user
                </button>
              </form>
            ) : null}
            {authMode() === "local" ? (
              <form action={localSignOutAction}>
                <button type="submit" className="text-slate-400 underline hover:text-slate-600">
                  sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
