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

      {/* Each row's inputs belong to a <form> rendered after the table (the
          HTML `form` attribute) — real <td> cells keep the columns aligned
          under their headers. */}
      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className={`${cell} font-medium`}>Name</th>
            <th className={`${cell} font-medium`}>Type</th>
            <th className={`${cell} font-medium`}>Curriculum</th>
            <th className={`${cell} font-medium`}>Students</th>
            <th className={`${cell} font-medium`}>Status</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {schools.map((sc) => {
            const formId = `school-${sc.id}`;
            return (
              <tr key={sc.id} className="border-b border-slate-100 align-middle last:border-0">
                <td className={cell}>
                  <input form={formId} name="name" defaultValue={sc.name} required className={`${input} w-full min-w-40`} />
                </td>
                <td className={cell}>
                  <input
                    form={formId}
                    name="schoolType"
                    defaultValue={sc.schoolType ?? ""}
                    placeholder="SK / SJKC…"
                    className={`${input} w-full min-w-24`}
                  />
                </td>
                <td className={cell}>
                  <input
                    form={formId}
                    name="curriculum"
                    defaultValue={sc.curriculum ?? ""}
                    placeholder="KSSR"
                    className={`${input} w-full min-w-20`}
                  />
                </td>
                <td className={`${cell} whitespace-nowrap text-xs text-slate-400`}>
                  {sc.studentCount} student{sc.studentCount === 1 ? "" : "s"}
                </td>
                <td className={cell}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sc.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {sc.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  {/* Only the clicked button's isActive value is submitted. */}
                  <button
                    form={formId}
                    name="isActive"
                    value={sc.isActive ? "true" : "false"}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    save
                  </button>
                  <button
                    form={formId}
                    name="isActive"
                    value={sc.isActive ? "false" : "true"}
                    className="ml-3 text-xs text-slate-500 hover:underline"
                  >
                    {sc.isActive ? "deactivate" : "reactivate"}
                  </button>
                </td>
              </tr>
            );
          })}
          {schools.length === 0 ? (
            <tr>
              <td className={`${cell} text-slate-400`} colSpan={6}>
                No schools yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {schools.map((sc) => (
        <form key={sc.id} id={`school-${sc.id}`} action={updateSchoolAction} className="hidden">
          <input type="hidden" name="schoolId" value={sc.id} />
        </form>
      ))}

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
