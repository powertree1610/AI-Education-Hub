import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { getCurrentConsents, listAccessibleStudentIds } from "@platform/shared";
import { endSessionAction, startSessionAction } from "@/actions/sessions";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const db = getDb();

  let students: { id: string; fullName: string; studentCode: string }[] = [];
  if (user.role === "admin") {
    students = await db
      .select({ id: s.students.id, fullName: s.students.fullName, studentCode: s.students.studentCode })
      .from(s.students)
      .where(eq(s.students.status, "active"));
  } else {
    const ids = await listAccessibleStudentIds(db, user.id);
    if (ids.length > 0) {
      students = await db
        .select({ id: s.students.id, fullName: s.students.fullName, studentCode: s.students.studentCode })
        .from(s.students)
        .where(inArray(s.students.id, ids));
    }
  }

  const consentByStudent = new Map<string, boolean>();
  for (const st of students) {
    const consents = await getCurrentConsents(db, st.id);
    consentByStudent.set(st.id, consents.get("ai_interaction") === "granted");
  }

  const activeSessions = await db
    .select({
      id: s.aiSessions.id,
      startedAt: s.aiSessions.startedAt,
      studentName: s.students.fullName,
    })
    .from(s.aiSessions)
    .innerJoin(s.students, eq(s.students.id, s.aiSessions.studentId))
    .where(eq(s.aiSessions.status, "active"))
    .orderBy(desc(s.aiSessions.startedAt));

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Kiosk Sessions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start a supervised AI session for a student on this device, then hand it over.
        </p>
      </div>

      {activeSessions.length > 0 ? (
        <section>
          <h2 className="font-medium">Active sessions</h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {activeSessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{session.studentName}</span>{" "}
                  <span className="text-slate-500">
                    since {new Date(session.startedAt).toLocaleTimeString()}
                  </span>
                </span>
                <span className="flex gap-3">
                  <Link href={`/kiosk/${session.id}`} className="text-teal-700 hover:underline">
                    open kiosk
                  </Link>
                  <form action={endSessionAction}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button type="submit" className="text-red-600 hover:underline">
                      end
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-medium">Start a session</h2>
        {students.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No students available to you.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {students.map((st) => {
              const hasConsent = consentByStudent.get(st.id) ?? false;
              return (
                <li key={st.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{st.fullName}</span>{" "}
                    <span className="text-slate-500">· {st.studentCode}</span>
                  </span>
                  {hasConsent ? (
                    <form action={startSessionAction}>
                      <input type="hidden" name="studentId" value={st.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        Start session
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-amber-600">no AI-interaction consent</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
