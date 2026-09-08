import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { countDistinct, desc, eq, inArray, sum } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, parseLocalUrl } from "@platform/shared";
import {
  activateGoalAction,
  addGoalUpdateAction,
  declineGoalAction,
  setGoalStatusAction,
} from "@/actions/goals";
import {
  createTeachingMaterialAction,
  proposeGoalFromMaterialAction,
  setMaterialActiveAction,
} from "@/actions/materials";
import { createReferralAction } from "@/actions/safeguarding";
import { ResultsSection } from "@/components/results-section";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Teacher's Student 360 (lite): approved profile, four-source comparison,
 *  results, portfolio, intake history. */
export default async function TeacherStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ referred?: string }>;
}) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const { referred } = await searchParams;
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

  // Latest progress note per goal (first row per goal_id, newest first).
  const goalIds = goals.map((g) => g.id);
  const updates = goalIds.length
    ? await db
        .select()
        .from(s.goalUpdates)
        .where(inArray(s.goalUpdates.goalId, goalIds))
        .orderBy(desc(s.goalUpdates.updatedAt))
    : [];
  const latestUpdate = new Map<string, (typeof updates)[number]>();
  for (const u of updates) if (!latestUpdate.has(u.goalId)) latestUpdate.set(u.goalId, u);

  const materials = await db
    .select({
      id: s.teachingMaterials.id,
      title: s.teachingMaterials.title,
      instructions: s.teachingMaterials.instructions,
      fileUrl: s.teachingMaterials.fileUrl,
      dueDate: s.teachingMaterials.dueDate,
      isActive: s.teachingMaterials.isActive,
      createdAt: s.teachingMaterials.createdAt,
      subjectName: s.subjects.name,
    })
    .from(s.teachingMaterials)
    .leftJoin(s.subjects, eq(s.subjects.id, s.teachingMaterials.subjectId))
    .where(eq(s.teachingMaterials.studentId, id))
    .orderBy(desc(s.teachingMaterials.createdAt));

  // Workspace insight: Learn sessions per material + the hint telemetry the
  // Socratic prompts log through log_activity.
  const materialIds = materials.map((m) => m.id);
  const materialStats = new Map<
    string,
    { sessions: number; hintsUsed: number; attempted: number; correct: number }
  >();
  if (materialIds.length > 0) {
    const rows = await db
      .select({
        materialId: s.aiSessions.materialId,
        sessions: countDistinct(s.aiSessions.id),
        hintsUsed: sum(s.sessionActivities.hintsUsed),
        attempted: sum(s.sessionActivities.attempted),
        correct: sum(s.sessionActivities.correct),
      })
      .from(s.aiSessions)
      .leftJoin(s.sessionActivities, eq(s.sessionActivities.sessionId, s.aiSessions.id))
      .where(inArray(s.aiSessions.materialId, materialIds))
      .groupBy(s.aiSessions.materialId);
    for (const r of rows) {
      if (r.materialId) {
        materialStats.set(r.materialId, {
          sessions: r.sessions,
          hintsUsed: Number(r.hintsUsed ?? 0),
          attempted: Number(r.attempted ?? 0),
          correct: Number(r.correct ?? 0),
        });
      }
    }
  }

  const subjects = await db.select().from(s.subjects).orderBy(s.subjects.name);

  const materialTitle = new Map(materials.map((m) => [m.id, m.title]));

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
          <Link
            href={`/teacher/students/${id}/reports`}
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            Reports
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
                <div className="text-lg font-semibold text-teal-800">{l.score} / 5</div>
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
            {goals.map((g) => {
              const latest = latestUpdate.get(g.id);
              return (
                <li key={g.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span>
                      {g.title}{" "}
                      <span className="text-xs text-slate-400">
                        · {g.goalType} · asked by {g.requestedByRole}
                        {g.targetDate ? ` · target ${g.targetDate}` : ""}
                        {g.materialId && materialTitle.has(g.materialId)
                          ? ` · from “${materialTitle.get(g.materialId)}”`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`text-xs ${
                        g.status === "active" || g.status === "improving"
                          ? "text-green-600"
                          : g.status === "achieved"
                            ? "text-teal-700 font-medium"
                            : g.status === "proposed"
                              ? "text-amber-600"
                              : "text-slate-400"
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>

                  {latest ? (
                    <div className="text-xs text-slate-500">
                      Latest: {latest.note}
                      {latest.progress !== null ? (
                        <span className="ml-2 inline-flex items-center gap-1 align-middle">
                          <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 align-middle">
                            <span
                              className="block h-full rounded-full bg-teal-600"
                              style={{ width: `${latest.progress}%` }}
                            />
                          </span>
                          {latest.progress}%
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {g.status === "proposed" ? (
                    <div className="flex items-center gap-2">
                      <form action={activateGoalAction} className="flex items-center gap-2">
                        <input type="hidden" name="goalId" value={g.id} />
                        <input
                          type="date"
                          name="targetDate"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          title="Target date (optional)"
                        />
                        <button className="rounded-md bg-teal-700 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800">
                          Activate
                        </button>
                      </form>
                      <form action={declineGoalAction}>
                        <input type="hidden" name="goalId" value={g.id} />
                        <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                          Decline
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {g.status === "active" || g.status === "improving" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {(g.status === "active"
                        ? (["improving", "achieved", "discontinued"] as const)
                        : (["achieved", "active", "discontinued"] as const)
                      ).map((next) => (
                        <form key={next} action={setGoalStatusAction}>
                          <input type="hidden" name="goalId" value={g.id} />
                          <input type="hidden" name="status" value={next} />
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                            → {next}
                          </button>
                        </form>
                      ))}
                      <form action={addGoalUpdateAction} className="flex items-center gap-1">
                        <input type="hidden" name="goalId" value={g.id} />
                        <input
                          name="note"
                          required
                          placeholder="progress note…"
                          className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          name="progress"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="%"
                          className="w-14 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button className="text-xs text-teal-700 hover:underline">save</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">Teaching materials</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tasks you set for this student. Active materials appear in their Learn workspace —
          the AI tutor sees the task and asks for their try first.
        </p>
        {materials.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No materials yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
            {materials.map((m) => {
              const stats = materialStats.get(m.id);
              const fileKey = m.fileUrl ? parseLocalUrl(m.fileUrl) : null;
              return (
                <li key={m.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={m.isActive ? "" : "text-slate-400 line-through"}>
                      {m.title}{" "}
                      <span className="text-xs text-slate-400 no-underline">
                        {m.subjectName ? `· ${m.subjectName} ` : ""}
                        {m.dueDate ? `· due ${m.dueDate} ` : ""}
                        {fileKey ? (
                          <>
                            ·{" "}
                            <a
                              href={`/api/files/${fileKey}`}
                              target="_blank"
                              className="text-teal-700 hover:underline"
                            >
                              file
                            </a>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <form action={setMaterialActiveAction}>
                      <input type="hidden" name="materialId" value={m.id} />
                      <input type="hidden" name="isActive" value={m.isActive ? "false" : "true"} />
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                        {m.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  </div>
                  {m.instructions ? (
                    <p className="text-xs text-slate-500">{m.instructions}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      {stats
                        ? `${stats.sessions} session${stats.sessions === 1 ? "" : "s"} · ${stats.hintsUsed} hints · ${stats.correct}/${stats.attempted} correct`
                        : "not started yet"}
                    </span>
                    <form action={proposeGoalFromMaterialAction} className="ml-auto flex items-center gap-1">
                      <input type="hidden" name="materialId" value={m.id} />
                      <input
                        name="title"
                        required
                        placeholder="goal from this material…"
                        className="w-48 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="date"
                        name="targetDate"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        title="Target date (optional; defaults to the due date)"
                      />
                      <button className="text-xs text-teal-700 hover:underline">set goal</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-3 rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600">
            Add a material
          </summary>
          <form action={createTeachingMaterialAction} className="space-y-2 border-t border-slate-100 p-4">
            <input type="hidden" name="studentId" value={id} />
            <div className="flex flex-wrap gap-2">
              <input
                name="title"
                required
                placeholder="Title (e.g. Fractions worksheet 3)"
                className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <select name="subjectId" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">No subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm text-slate-500">
                due
                <input type="date" name="dueDate" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
              </label>
            </div>
            <textarea
              name="instructions"
              rows={2}
              placeholder="Instructions for the student (the AI tutor sees these too)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <input type="file" name="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="text-sm" />
              <button className="ml-auto rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
                Add material
              </button>
            </div>
            <p className="text-xs text-slate-400">
              File is optional (JPG, PNG, WebP or PDF, max 15 MB) — it is read into text once so
              the tutor can see the actual task.
            </p>
          </form>
        </details>
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

      <section>
        {referred === "1" && (
          <p className="mb-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Safeguarding concern recorded. The safeguarding lead has been notified — you will not
            see the case here.
          </p>
        )}
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600">
            Raise safeguarding concern
          </summary>
          <form action={createReferralAction} className="space-y-2 border-t border-slate-100 p-4">
            <input type="hidden" name="studentId" value={id} />
            <p className="text-xs text-slate-500">
              Record only what you saw or heard — facts, not interpretation. This goes directly to
              the safeguarding lead; it is not visible to teachers, admins or parents.
            </p>
            <textarea
              name="factualRecord"
              required
              minLength={10}
              rows={3}
              placeholder="What was said or seen, when, and by whom"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500" htmlFor="occurredOn">
                Occurred on
              </label>
              <input
                id="occurredOn"
                type="date"
                name="occurredOn"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <button className="ml-auto rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
                Submit to safeguarding lead
              </button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
