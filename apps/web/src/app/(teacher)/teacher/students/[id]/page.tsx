import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent } from "@platform/shared";
import { ResultsSection } from "@/components/results-section";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Teacher's Student 360 (lite): approved profile, four-source comparison,
 *  results, portfolio, intake history. */
export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const db = getDb();

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, { userId: user.id, role: "teacher", studentId: id });
    if (!allowed) redirect("/teacher");
  }

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const levels = await db
    .select({
      kind: s.vCurrentLevels.kind,
      key: s.vCurrentLevels.key,
      score: s.vCurrentLevels.score,
      effectiveFrom: s.vCurrentLevels.effectiveFrom,
    })
    .from(s.vCurrentLevels)
    .where(eq(s.vCurrentLevels.studentId, id));

  const assessments = await db
    .select({
      subject: s.subjects.name,
      assessorRole: s.academicAssessments.assessorRole,
      rating: s.academicAssessments.rating,
      notes: s.academicAssessments.notes,
      assessedAt: s.academicAssessments.assessedAt,
    })
    .from(s.academicAssessments)
    .innerJoin(s.subjects, eq(s.subjects.id, s.academicAssessments.subjectId))
    .where(eq(s.academicAssessments.studentId, id))
    .orderBy(desc(s.academicAssessments.assessedAt));

  // Latest rating per subject per source — differences are surfaced, never averaged.
  const comparison = new Map<string, { parent?: string; teacher?: string }>();
  for (const a of assessments) {
    const entry = comparison.get(a.subject) ?? {};
    if (!entry[a.assessorRole]) entry[a.assessorRole] = a.rating;
    comparison.set(a.subject, entry);
  }

  const interests = await db
    .select({
      name: s.interests.name,
      freeText: s.studentInterests.freeText,
      kind: s.studentInterests.kind,
      source: s.studentInterests.source,
    })
    .from(s.studentInterests)
    .leftJoin(s.interests, eq(s.interests.id, s.studentInterests.interestId))
    .where(eq(s.studentInterests.studentId, id));

  const goals = await db
    .select()
    .from(s.goals)
    .where(eq(s.goals.studentId, id))
    .orderBy(desc(s.goals.status));

  const samples = await db
    .select({
      id: s.workSamples.id,
      title: s.workSamples.titleTopic,
      workType: s.workSamples.workType,
      workDate: s.workSamples.workDate,
    })
    .from(s.workSamples)
    .where(eq(s.workSamples.studentId, id))
    .orderBy(desc(s.workSamples.createdAt))
    .limit(10);

  const submissions = await db
    .select({
      formType: s.formSubmissions.formType,
      submittedAt: s.formSubmissions.submittedAt,
      submittedByName: s.users.name,
    })
    .from(s.formSubmissions)
    .leftJoin(s.users, eq(s.users.id, s.formSubmissions.submittedBy))
    .where(eq(s.formSubmissions.studentId, id))
    .orderBy(desc(s.formSubmissions.submittedAt));

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {student.fullName}{" "}
            <span className="text-base font-normal text-slate-500">· {student.studentCode}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {student.schoolGrade ?? ""} · AI language: {student.preferredAiLanguage ?? "—"} · access:{" "}
            {student.aiAccessLevel}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/teacher/students/${id}/baseline`}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Baseline form
          </Link>
          <Link
            href={`/teacher/students/${id}/interview`}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Student interview
          </Link>
        </div>
      </div>

      <section>
        <h2 className="font-medium">Current levels (teacher-approved)</h2>
        {levels.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No levels yet — set a baseline.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {levels.map((l) => (
              <li key={`${l.kind}-${l.key}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-medium">{l.key}</span>{" "}
                <span className="text-slate-500">({l.kind === "academic_skill" ? "academic" : "development"})</span>
                <div className="text-lg font-semibold text-indigo-700">{l.score} / 5</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">Parent vs teacher view (latest, never averaged)</h2>
        {comparison.size === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No questionnaire data yet.</p>
        ) : (
          <table className="mt-2 w-full max-w-lg rounded-lg border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Parent says</th>
                <th className="px-3 py-2 font-medium">Teacher says</th>
              </tr>
            </thead>
            <tbody>
              {[...comparison.entries()].map(([subject, views]) => (
                <tr
                  key={subject}
                  className={`border-b border-slate-100 last:border-0 ${
                    views.parent && views.teacher && views.parent !== views.teacher ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">{subject}</td>
                  <td className="px-3 py-2">{views.parent?.replace("_", " ") ?? "—"}</td>
                  <td className="px-3 py-2">{views.teacher?.replace("_", " ") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-medium">Interests & favourites (by source)</h2>
        {interests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {interests.map((i, idx) => (
              <li key={idx} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {i.name ?? i.freeText}
                <span className="ml-1 text-slate-400">
                  · {i.kind !== "interest" ? `${i.kind.replace("favourite_", "fav ")} · ` : ""}
                  {i.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">Goals</h2>
        {goals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No goals yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-4 py-2">
                <span>
                  {g.title}{" "}
                  <span className="text-xs text-slate-400">
                    · {g.goalType} · asked by {g.requestedByRole}
                  </span>
                </span>
                <span
                  className={`text-xs ${
                    g.status === "active" || g.status === "improving"
                      ? "text-green-600"
                      : g.status === "proposed"
                        ? "text-amber-600"
                        : "text-slate-400"
                  }`}
                >
                  {g.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResultsSection studentId={id} />

      <section>
        <h2 className="font-medium">Recent work ({samples.length})</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
          {samples.map((w) => (
            <li key={w.id} className="px-4 py-2">
              {w.title ?? "Untitled"}{" "}
              <span className="text-xs text-slate-400">
                · {w.workType} · {w.workDate ?? "no date"}
              </span>
            </li>
          ))}
          {samples.length === 0 ? (
            <li className="px-4 py-2 text-slate-500">No uploads yet.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Intake history</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
          {submissions.map((f, i) => (
            <li key={i} className="px-4 py-2">
              {f.formType.replace(/_/g, " ")}{" "}
              <span className="text-xs text-slate-400">
                · {new Date(f.submittedAt).toLocaleDateString()} · by {f.submittedByName ?? "?"}
              </span>
            </li>
          ))}
          {submissions.length === 0 ? (
            <li className="px-4 py-2 text-slate-500">No forms submitted yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
