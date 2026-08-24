import { asc } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { createStaffUserAction, setPasswordAction, setUserActiveAction } from "@/actions/users";
import { getDb } from "@/lib/db";
import { authMode } from "@/lib/env";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

export default async function UsersPage() {
  const users = await getDb()
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      username: s.users.username,
      role: s.users.role,
      isActive: s.users.isActive,
      hasPassword: s.users.passwordHash,
    })
    .from(s.users)
    .orderBy(asc(s.users.role), asc(s.users.name));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        {authMode() !== "local" ? (
          <p className="mt-1 text-sm text-amber-600">
            Local password auth is not active (AUTH_SECRET not set) — passwords set here
            take effect once it is.
          </p>
        ) : null}
      </div>

      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email / username</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Password</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100 align-top last:border-0">
              <td className="px-4 py-2 font-medium">{u.name}</td>
              <td className="px-4 py-2">{u.email ?? u.username ?? "—"}</td>
              <td className="px-4 py-2">{u.role}</td>
              <td className="px-4 py-2">
                {u.role === "student" ? (
                  <span className="text-slate-400">n/a (kiosk)</span>
                ) : (
                  <form action={setPasswordAction} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      placeholder={u.hasPassword ? "reset…" : "set password…"}
                      className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button type="submit" className="text-xs text-teal-700 hover:underline">
                      save
                    </button>
                    {u.hasPassword ? <span className="text-xs text-green-600">✓</span> : null}
                  </form>
                )}
              </td>
              <td className="px-4 py-2">
                <span className={u.isActive ? "text-green-600" : "text-red-600"}>
                  {u.isActive ? "active" : "inactive"}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <form action={setUserActiveAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="active" value={u.isActive ? "false" : "true"} />
                  <button type="submit" className="text-xs text-slate-500 hover:underline">
                    {u.isActive ? "deactivate" : "reactivate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        action={createStaffUserAction}
        className="grid max-w-md grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="col-span-2 font-medium">New staff user</div>
        <label className={label}>
          Name *
          <input name="name" required className={field} />
        </label>
        <label className={label}>
          Email *
          <input name="email" type="email" required className={field} />
        </label>
        <label className={label}>
          Role
          <select name="role" className={field}>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <div className="col-span-2">
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Create user
          </button>
        </div>
      </form>
    </div>
  );
}
