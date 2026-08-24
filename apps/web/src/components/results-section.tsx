import { asc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { addResultAction } from "@/actions/results";
import { getDb } from "@/lib/db";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

/** Academic results list + entry form (M5) — used by admin and teacher pages. */
export async function ResultsSection({ studentId }: { studentId: string }) {
  const db = getDb();

  const results = await db
    .select({
      id: s.academicResults.id,
      subject: s.subjects.name,
      assessmentType: s.academicResults.assessmentType,
      assessmentDate: s.academicResults.assessmentDate,
      term: s.academicResults.term,
      score: s.academicResults.score,
      maxScore: s.academicResults.maxScore,
      grade: s.academicResults.grade,
      classPosition: s.academicResults.classPosition,
      source: s.academicResults.source,
    })
    .from(s.academicResults)
    .innerJoin(s.subjects, eq(s.subjects.id, s.academicResults.subjectId))
    .where(eq(s.academicResults.studentId, studentId))
    .orderBy(asc(s.academicResults.assessmentDate));

  const subjects = await db.select().from(s.subjects).orderBy(s.subjects.name);

  return (
    <section>
      <h2 className="font-medium">Academic results ({results.length})</h2>
      {results.length > 0 ? (
        <table className="mt-2 w-full rounded-lg border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Assessment</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Grade</th>
              <th className="px-3 py-2 font-medium">Pos</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">{r.assessmentDate}</td>
                <td className="px-3 py-2">{r.subject}</td>
                <td className="px-3 py-2">
                  {r.assessmentType}
                  {r.term ? ` (${r.term})` : ""}
                </td>
                <td className="px-3 py-2">
                  {r.score != null ? `${r.score}${r.maxScore != null ? `/${r.maxScore}` : ""}` : "—"}
                </td>
                <td className="px-3 py-2">{r.grade ?? "—"}</td>
                <td className="px-3 py-2">{r.classPosition ?? "—"}</td>
                <td className="px-3 py-2">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          No results yet — older results are welcome, they give the AI a before/after baseline.
        </p>
      )}

      <details className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Add result</summary>
        <form action={addResultAction} className="mt-3 grid grid-cols-3 gap-3">
          <input type="hidden" name="studentId" value={studentId} />
          <label className={label}>
            Subject *
            <select name="subjectId" required className={field}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Assessment type *
            <input name="assessmentType" required placeholder="School mid-year exam" className={field} />
          </label>
          <label className={label}>
            Date *
            <input name="assessmentDate" type="date" required className={field} />
          </label>
          <label className={label}>
            School year
            <input name="schoolYear" placeholder="2026" className={field} />
          </label>
          <label className={label}>
            Term
            <input name="term" placeholder="Term 1" className={field} />
          </label>
          <label className={label}>
            Source
            <select name="source" className={field}>
              <option value="school">school</option>
              <option value="centre">centre</option>
            </select>
          </label>
          <label className={label}>
            Score
            <input name="score" type="number" step="0.5" min="0" className={field} />
          </label>
          <label className={label}>
            Max score
            <input name="maxScore" type="number" step="0.5" min="0" className={field} />
          </label>
          <label className={label}>
            Grade
            <input name="grade" placeholder="C" className={field} />
          </label>
          <label className={label}>
            Class position
            <input name="classPosition" type="number" min="1" className={field} />
          </label>
          <label className={`${label} col-span-2`}>
            Teacher comment
            <input name="teacherComment" className={field} />
          </label>
          <div className="col-span-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add result
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
