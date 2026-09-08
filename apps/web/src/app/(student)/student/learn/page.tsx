import Link from "next/link";
import { desc, eq, inArray, and } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { checkConsent, parseLocalUrl } from "@platform/shared";
import { startStudentSessionAction } from "@/actions/student-sessions";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/**
 * Learning Workspace (v6): the student's teacher-set tasks plus free
 * practice. Starting a task opens a Learn session anchored to the material —
 * the tutor sees the actual task and asks for the student's try first.
 */
export default async function StudentLearnPage() {
  const user = await requireRoleOrRedirect("student");
  const student = await studentForUser(user.id);

  if (!student) {
    return (
      <p className="mt-10 text-center text-lg text-slate-600">
        Your account isn&apos;t linked yet — please ask your teacher. 🙂
      </p>
    );
  }

  const db = getDb();
  const { granted } = await checkConsent(db, student.id, ["ai_interaction"]);
  const enabled = student.unsupervisedAccessEnabled && granted && student.status === "active";

  const materials = enabled
    ? await db
        .select({
          id: s.teachingMaterials.id,
          title: s.teachingMaterials.title,
          instructions: s.teachingMaterials.instructions,
          fileUrl: s.teachingMaterials.fileUrl,
          fileType: s.teachingMaterials.fileType,
          dueDate: s.teachingMaterials.dueDate,
          subjectName: s.subjects.name,
        })
        .from(s.teachingMaterials)
        .leftJoin(s.subjects, eq(s.subjects.id, s.teachingMaterials.subjectId))
        .where(
          and(eq(s.teachingMaterials.studentId, student.id), eq(s.teachingMaterials.isActive, true)),
        )
        .orderBy(desc(s.teachingMaterials.createdAt))
    : [];

  // "already tried" badge — any Learn session anchored to the material.
  const materialIds = materials.map((m) => m.id);
  const tried = new Set<string>();
  if (materialIds.length > 0) {
    const rows = await db
      .select({ materialId: s.aiSessions.materialId })
      .from(s.aiSessions)
      .where(inArray(s.aiSessions.materialId, materialIds));
    for (const r of rows) if (r.materialId) tried.add(r.materialId);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-800" style={{ fontFamily: "var(--font-display)" }}>
          📚 Let&apos;s learn!
        </h1>
        <Link href="/student" className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>
      </div>

      {!enabled ? (
        <p className="mt-8 text-center text-slate-600">
          Learning from home isn&apos;t switched on right now — ask your teacher. 🙂
        </p>
      ) : (
        <>
          <h2 className="mt-6 font-semibold text-slate-700">My tasks from teacher</h2>
          {materials.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No tasks right now — try free practice below! 🎉
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {materials.map((m) => {
                const fileKey = m.fileUrl ? parseLocalUrl(m.fileUrl) : null;
                return (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {m.title}{" "}
                          {tried.has(m.id) ? (
                            <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-normal text-teal-800">
                              tried ✔
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {m.subjectName ? `${m.subjectName} · ` : ""}
                          {m.dueDate ? `due ${m.dueDate}` : "no due date"}
                          {fileKey ? (
                            <>
                              {" · "}
                              <a
                                href={`/api/files/${fileKey}`}
                                target="_blank"
                                className="text-teal-700 hover:underline"
                              >
                                see the worksheet
                              </a>
                            </>
                          ) : null}
                        </p>
                        {m.instructions ? (
                          <p className="mt-1 text-sm text-slate-600">{m.instructions}</p>
                        ) : null}
                      </div>
                      <form action={startStudentSessionAction}>
                        <input type="hidden" name="kind" value="academic" />
                        <input type="hidden" name="materialId" value={m.id} />
                        <button className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:scale-[1.03]">
                          ✍️ Do it
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="mt-8 font-semibold text-slate-700">Or practise anything</h2>
          <form action={startStudentSessionAction} className="mt-3">
            <input type="hidden" name="kind" value="academic" />
            <button className="w-full rounded-3xl border-2 border-dashed border-teal-300 bg-white/60 px-6 py-5 text-lg font-bold text-teal-800 transition hover:bg-white">
              🚀 Free practice
              <span className="mt-1 block text-sm font-normal text-slate-500">
                Homework help, quizzes and revision on anything
              </span>
            </button>
          </form>
        </>
      )}
    </div>
  );
}
