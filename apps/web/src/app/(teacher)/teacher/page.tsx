import Link from "next/link";
import { inArray } from "drizzle-orm";
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

  return (
    <div>
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
              <Link href={`/admin/students/${st.id}`} className="text-blue-600 hover:underline">
                view
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
