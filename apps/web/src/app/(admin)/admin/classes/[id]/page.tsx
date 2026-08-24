import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { schema as s } from "@platform/db";
import {
  assignClassTeacherAction,
  endEnrollmentAction,
  enrollStudentAction,
  removeClassTeacherAction,
} from "@/actions/classes";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const field = "rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const cls = (await db.select().from(s.classes).where(eq(s.classes.id, id)).limit(1))[0];
  if (!cls) notFound();

  const enrollments = await db
    .select({
      enrollmentId: s.classEnrollments.id,
      startDate: s.classEnrollments.startDate,
      studentId: s.students.id,
      studentName: s.students.fullName,
      studentCode: s.students.studentCode,
    })
    .from(s.classEnrollments)
    .innerJoin(s.students, eq(s.students.id, s.classEnrollments.studentId))
    .where(and(eq(s.classEnrollments.classId, id), isNull(s.classEnrollments.endDate)))
    .orderBy(s.students.fullName);

  const enrolledIds = enrollments.map((e) => e.studentId);
  const availableStudents = await db
    .select({ id: s.students.id, name: s.students.fullName, code: s.students.studentCode })
    .from(s.students)
    .where(
      and(
        eq(s.students.status, "active"),
        ...(enrolledIds.length ? [notInArray(s.students.id, enrolledIds)] : []),
      ),
    )
    .orderBy(s.students.fullName);

  const teachers = await db
    .select({
      classTeacherId: s.classTeachers.id,
      role: s.classTeachers.role,
      name: s.users.name,
      userId: s.users.id,
    })
    .from(s.classTeachers)
    .innerJoin(s.users, eq(s.users.id, s.classTeachers.userId))
    .where(eq(s.classTeachers.classId, id));

  const assignedTeacherIds = teachers.map((t) => t.userId);
  const availableTeachers = await db
    .select({ id: s.users.id, name: s.users.name })
    .from(s.users)
    .where(
      and(
        eq(s.users.role, "teacher"),
        eq(s.users.isActive, true),
        ...(assignedTeacherIds.length ? [notInArray(s.users.id, assignedTeacherIds)] : []),
      ),
    )
    .orderBy(s.users.name);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{cls.name}</h1>
        <p className="text-sm text-slate-500">{cls.programme ?? "—"}</p>
      </div>

      <section>
        <h2 className="font-medium">Teachers</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {teachers.map((t) => (
            <li key={t.classTeacherId} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <span className="font-medium">{t.name}</span>{" "}
                <span className="text-slate-500">· {t.role}</span>
              </span>
              <form action={removeClassTeacherAction}>
                <input type="hidden" name="classTeacherId" value={t.classTeacherId} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  remove
                </button>
              </form>
            </li>
          ))}
          {teachers.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">No teachers assigned.</li>
          ) : null}
        </ul>
        {availableTeachers.length > 0 ? (
          <form action={assignClassTeacherAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="classId" value={id} />
            <select name="userId" required className={field}>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="role" className={field}>
              <option value="primary">primary</option>
              <option value="support">support</option>
            </select>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Assign
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className="font-medium">Enrolled students ({enrollments.length})</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {enrollments.map((e) => (
            <li key={e.enrollmentId} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                <Link href={`/admin/students/${e.studentId}`} className="font-medium text-teal-700 hover:underline">
                  {e.studentName}
                </Link>{" "}
                <span className="text-slate-500">
                  · {e.studentCode} · since {e.startDate}
                </span>
              </span>
              <form action={endEnrollmentAction}>
                <input type="hidden" name="enrollmentId" value={e.enrollmentId} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  end enrollment
                </button>
              </form>
            </li>
          ))}
          {enrollments.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-500">No students enrolled.</li>
          ) : null}
        </ul>
        {availableStudents.length > 0 ? (
          <form action={enrollStudentAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="classId" value={id} />
            <select name="studentId" required className={field}>
              {availableStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Enroll
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
