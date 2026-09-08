import { localSignOutAction } from "@/actions/auth";
import { requireRoleOrRedirect } from "@/lib/guard";

/** Kid-styled shell for the student's own portal (Home Mode) — no staff
 *  nav, same warm chrome as the kiosk. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect("student");
  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50 via-orange-50 to-teal-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-4">
        <div className="flex justify-end">
          <form action={localSignOutAction}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-xs text-slate-500 hover:bg-white"
            >
              Sign out
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
