import Link from "next/link";
import { desc, eq, isNull, and, sql } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { createClassAction } from "@/actions/classes";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function ClassesPage() {
  const db = getDb();

  const classes = await db
    .select({
      id: s.classes.id,
      name: s.classes.name,
      programme: s.classes.programme,
      isActive: s.classes.isActive,
      enrolled: sql<number>`(select count(*)::int from core.class_enrollments e
        where e.class_id = ${s.classes.id} and (e.end_date is null or e.end_date >= current_date))`,
    })
    .from(s.classes)
    .orderBy(desc(s.classes.isActive), s.classes.name);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Classes</h1>
        {classes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No classes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {classes.map((cls) => (
              <li key={cls.id}>
                <Link
                  href={`/admin/classes/${cls.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span>
                    <span className="font-medium">{cls.name}</span>{" "}
                    <span className="text-slate-500">{cls.programme ?? ""}</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {cls.enrolled} enrolled{cls.isActive ? "" : " · inactive"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        action={createClassAction}
        className="grid max-w-md grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="col-span-2 font-medium">New class</div>
        <label className="block text-sm font-medium text-slate-700">
          Name *
          <input name="name" required placeholder="P4 English — Mon/Wed 4pm" className={field} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Programme
          <input name="programme" placeholder="Primary Tuition" className={field} />
        </label>
        <div className="col-span-2">
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Create class
          </button>
        </div>
      </form>
    </div>
  );
}
