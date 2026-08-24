import Link from "next/link";
import { desc } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await getDb()
    .select({
      id: s.students.id,
      code: s.students.studentCode,
      name: s.students.fullName,
      status: s.students.status,
      grade: s.students.schoolGrade,
    })
    .from(s.students)
    .orderBy(desc(s.students.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Students</h1>
        <Link
          href="/admin/students/new"
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register student
        </Link>
      </div>
      {students.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No students yet — register the first one.</p>
      ) : (
        <table className="mt-4 w-full rounded-lg border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Grade</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{st.code}</td>
                <td className="px-4 py-2 font-medium">{st.name}</td>
                <td className="px-4 py-2">{st.grade ?? "—"}</td>
                <td className="px-4 py-2">{st.status}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/students/${st.id}`} className="text-blue-600 hover:underline">
                    open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
