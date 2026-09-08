import Link from "next/link";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { listAccessibleStudentIds } from "@platform/shared";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const db = getDb();

  let students: { id: string; fullName: string; studentCode: string }[] = [];
  if (user.role === "admin") {
    students = await db
      .select({ id: s.students.id, fullName: s.students.fullName, studentCode: s.students.studentCode })
      .from(s.students);
  } else {
    const ids = await listAccessibleStudentIds(db, user.id);
    if (ids.length > 0) {
      students = await db
        .select({ id: s.students.id, fullName: s.students.fullName, studentCode: s.students.studentCode })
        .from(s.students)
        .where(inArray(s.students.id, ids));
    }
  }

  const studentIds = students.map((st) => st.id);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  let pendingReviews = 0;
  let sessionsThisWeek = 0;
  let goalReviewsDue = 0;
  if (studentIds.length > 0) {
    const [pa] = (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.workAnalyses)
        .innerJoin(s.workSamples, eq(s.workSamples.id, s.workAnalyses.workSampleId))
        .where(
          and(
            eq(s.workAnalyses.reviewStatus, "pending_review"),
            inArray(s.workSamples.studentId, studentIds),
          ),
        )
    );
    const [po] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.observations)
      .where(and(eq(s.observations.status, "unverified"), inArray(s.observations.studentId, studentIds)));
    pendingReviews = (pa?.n ?? 0) + (po?.n ?? 0);

    const [sw] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.aiSessions)
      .where(and(inArray(s.aiSessions.studentId, studentIds), gte(s.aiSessions.startedAt, weekAgo)));
    sessionsThisWeek = sw?.n ?? 0;

    const [gd] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.goals)
      .where(
        and(
          inArray(s.goals.studentId, studentIds),
          inArray(s.goals.status, ["active", "improving"]),
          lte(s.goals.reviewDate, soon),
        ),
      );
    goalReviewsDue = gd?.n ?? 0;
  }

  const stat = (value: number, label: string, icon: string, href: string, warn = false) => {
    const hot = warn && value > 0;
    return (
      <Link
        href={href}
        className={`group flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
          hot ? "border-amber-300 bg-amber-50/50" : "border-slate-200"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
            hot ? "bg-amber-100" : "bg-teal-50"
          }`}
        >
          {icon}
        </span>
        <span>
          <span className={`block text-2xl font-semibold leading-tight ${hot ? "text-amber-700" : "text-slate-800"}`}>
            {value}
          </span>
          <span className="mt-0.5 block text-sm text-slate-500">
            {label}
            <span className="ml-1 text-teal-700 opacity-0 transition group-hover:opacity-100">→</span>
          </span>
        </span>
      </Link>
    );
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stat(students.length, "My students", "🎓", "/teacher")}
        {stat(pendingReviews, "Pending AI reviews", "🔍", "/teacher/review", true)}
        {stat(sessionsThisWeek, "Sessions this week", "💬", "/teacher/sessions")}
        {stat(goalReviewsDue, "Goal reviews due (7d)", "⭐", "/teacher", true)}
      </div>
      <h1 className="text-xl font-semibold">My Students</h1>
      {students.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No students assigned yet. Ask an admin to enrol students into your class or link
          them to you directly.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {students.map((st) => (
            <li key={st.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{st.fullName}</span>{" "}
                <span className="text-slate-500">· {st.studentCode}</span>
              </span>
              <Link href={`/teacher/students/${st.id}`} className="text-teal-700 hover:underline">
                view
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
