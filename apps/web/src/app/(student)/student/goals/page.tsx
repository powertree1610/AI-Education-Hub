import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/** Read-only "My goals" for the student — active work + wins. */
export default async function StudentGoalsPage() {
  const user = await requireRoleOrRedirect("student");
  const student = await studentForUser(user.id);
  if (!student) {
    return <p className="mt-10 text-center text-slate-600">Ask your teacher to link your account. 🙂</p>;
  }

  const db = getDb();
  const goals = await db
    .select()
    .from(s.goals)
    .where(eq(s.goals.studentId, student.id))
    .orderBy(desc(s.goals.startDate));
  const visible = goals.filter((g) => ["active", "improving", "achieved"].includes(g.status));

  const ids = visible.map((g) => g.id);
  const updates = ids.length
    ? await db
        .select()
        .from(s.goalUpdates)
        .where(inArray(s.goalUpdates.goalId, ids))
        .orderBy(desc(s.goalUpdates.updatedAt))
    : [];
  const latest = new Map<string, (typeof updates)[number]>();
  for (const u of updates) if (!latest.has(u.goalId)) latest.set(u.goalId, u);

  return (
    <div className="mx-auto mt-6 w-full max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-800" style={{ fontFamily: "var(--font-display)" }}>
          ⭐ My goals
        </h1>
        <Link href="/student" className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-center text-slate-600">
          No goals yet — your teacher will set some with you soon!
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((g) => {
            const u = latest.get(g.id);
            const progress = g.status === "achieved" ? 100 : (u?.progress ?? 0);
            return (
              <li key={g.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{g.title}</span>
                  {g.status === "achieved" ? <span title="Achieved!">🏆</span> : null}
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {u?.note ? <p className="mt-2 text-xs text-slate-500">{u.note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
