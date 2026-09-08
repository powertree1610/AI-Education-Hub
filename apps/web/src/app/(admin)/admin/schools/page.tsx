import { asc, sql } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { createSchoolAction, updateSchoolAction } from "@/actions/schools";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Schools master list — replaces the free-text school name on registration. */
export default async function SchoolsPage() {
  await requireRoleOrRedirect("admin");
  const db = getDb();
  const schools = await db
    .select({
      id: s.schools.id,
      name: s.schools.name,
      schoolType: s.schools.schoolType,
      curriculum: s.schools.curriculum,
      isActive: s.schools.isActive,
      studentCount: sql<number>`(select count(*)::int from core.students st where st.school_id = ${s.schools.id})`,
    })
    .from(s.schools)
    .orderBy(asc(s.schools.name));

  const cell = "px-4 py-2";
  const input = "rounded border border-slate-300 px-2 py-1 text-xs";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Schools</h1>
        <p className="mt-1 text-sm text-slate-500">
          The schools students attend (master list). Registration picks from here; inactive
          schools stay on old records but leave the dropdown.
        </p>
      </div>

      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className={cell}>Name</th>
            <th className={cell}>Type</th>
            <th className={cell}>Curriculum</th>
            <th className={cell}>Students</th>
            <th className={cell}>Status</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {schools.map((sc) => (
            <tr key={sc.id} className="border-b border-slate-100 align-middle last:border-0">
              <td colSpan={6} className="p-0">
                <form action={updateSchoolAction} className="flex w-full items-center gap-2 px-4 py-2">
                  <input type="hidden" name="schoolId" value={sc.id} />
                  <input name="name" defaultValue={sc.name} required className={`${input} w-56`} />
                  <input
                    name="schoolType"
                    defaultValue={sc.schoolType ?? ""}
                    placeholder="type (SK/SJKC…)"
                    className={`${input} w-28`}
                  />
                  <input
                    name="curriculum"
                    defaultValue={sc.curriculum ?? ""}
                    placeholder="curriculum"
                    className={`${input} w-24`}
                  />
                  <span className="w-16 text-xs text-slate-400">{sc.studentCount} student{sc.studentCount === 1 ? "" : "s"}</span>
                  <span className={`text-xs ${sc.isActive ? "text-green-600" : "text-red-600"}`}>
                    {sc.isActive ? "active" : "inactive"}
                  </span>
                  {/* Only the clicked button's isActive value is submitted. */}
                  <button
                    name="isActive"
                    value={sc.isActive ? "true" : "false"}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    save
                  </button>
                  <button
                    name="isActive"
                    value={sc.isActive ? "false" : "true"}
                    className="ml-auto text-xs text-slate-500 hover:underline"
                  >
                    {sc.isActive ? "deactivate" : "reactivate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {schools.length === 0 ? (
            <tr>
              <td className={`${cell} text-slate-400`} colSpan={6}>
                No schools yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <form
        action={createSchoolAction}
        className="flex max-w-xl flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        <div className="w-full font-medium">New school</div>
        <label className="text-slate-600">
          Name *
          <input name="name" required className="mt-1 block rounded-md border border-slate-300 px-2 py-1" />
        </label>
        <label className="text-slate-600">
          Type
          <input
            name="schoolType"
            placeholder="SK / SJKC / private"
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-slate-600">
          Curriculum
          <input name="curriculum" placeholder="KSSR" className="mt-1 block rounded-md border border-slate-300 px-2 py-1" />
        </label>
        <button className="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800">
          Add school
        </button>
      </form>
    </div>
  );
}
