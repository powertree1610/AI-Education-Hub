import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { CONSENT_TYPES, getCurrentConsents, parseLocalUrl } from "@platform/shared";
import { parentProposeGoalAction, parentSetConsentAction } from "@/actions/parents";
import { uploadWorkSampleAction } from "@/actions/uploads";
import { CONSENT_LABELS } from "@/lib/consent-labels";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";
import { isChildOfGuardianUser } from "@/lib/parents";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

interface PublishedReport {
  summary?: string;
  results_trend?: string;
  goals_achieved?: number;
  highlights?: string[];
}

export default async function ParentChildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRoleOrRedirect("guardian");
  const { id } = await params;
  const db = getDb();

  const { ok } = await isChildOfGuardianUser(db, user.id, id);
  if (!ok) redirect("/parent");

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) redirect("/parent");
  const name = student.preferredName ?? student.fullName;

  const reports = await db
    .select()
    .from(s.progressReports)
    .where(eq(s.progressReports.studentId, id))
    .orderBy(desc(s.progressReports.publishedAt));
  const published = reports.filter((r) => r.status === "published");

  const results = await db
    .select({
      subject: s.subjects.name,
      assessmentType: s.academicResults.assessmentType,
      assessmentDate: s.academicResults.assessmentDate,
      score: s.academicResults.score,
      maxScore: s.academicResults.maxScore,
      grade: s.academicResults.grade,
    })
    .from(s.academicResults)
    .innerJoin(s.subjects, eq(s.subjects.id, s.academicResults.subjectId))
    .where(eq(s.academicResults.studentId, id))
    .orderBy(asc(s.academicResults.assessmentDate));

  const sessions = await db
    .select({
      id: s.aiSessions.id,
      startedAt: s.aiSessions.startedAt,
      endedAt: s.aiSessions.endedAt,
      status: s.aiSessions.status,
    })
    .from(s.aiSessions)
    .where(eq(s.aiSessions.studentId, id))
    .orderBy(desc(s.aiSessions.startedAt))
    .limit(10);
  const sessionIds = sessions.map((x) => x.id);
  const activities = sessionIds.length
    ? await db
        .select({
          sessionId: s.sessionActivities.sessionId,
          activityType: s.sessionActivities.activityType,
          topic: s.sessionActivities.topic,
          attempted: s.sessionActivities.attempted,
          correct: s.sessionActivities.correct,
        })
        .from(s.sessionActivities)
        .where(inArray(s.sessionActivities.sessionId, sessionIds))
    : [];

  const goals = await db
    .select()
    .from(s.goals)
    .where(eq(s.goals.studentId, id))
    .orderBy(desc(s.goals.startDate));

  const works = await db
    .select({
      id: s.workSamples.id,
      title: s.workSamples.titleTopic,
      workType: s.workSamples.workType,
      workDate: s.workSamples.workDate,
      source: s.workSamples.source,
      fileUrl: s.workSamples.fileUrl,
    })
    .from(s.workSamples)
    .where(eq(s.workSamples.studentId, id))
    .orderBy(desc(s.workSamples.createdAt));

  const consents = await getCurrentConsents(db, id);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{student.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {student.studentCode} · {student.schoolGrade ?? "—"}
        </p>
      </div>

      <section>
        <h2 className="font-medium">Progress reports</h2>
        {published.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No published reports yet.</p>
        ) : (
          <ul className="mt-2 space-y-4">
            {published.map((r) => {
              const content = (r.content ?? {}) as PublishedReport;
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.period}</span>
                    <span className="text-xs text-slate-400">
                      published {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {content.summary ? <p className="mt-2 whitespace-pre-wrap">{content.summary}</p> : null}
                  {content.results_trend ? (
                    <p className="mt-2 text-slate-600">Results: {content.results_trend}</p>
                  ) : null}
                  {content.highlights?.length ? (
                    <ul className="mt-2 list-inside list-disc text-slate-600">
                      {content.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">School & centre results</h2>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No results recorded yet.</p>
        ) : (
          <table className="mt-2 w-full rounded-lg border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Assessment</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">{r.assessmentDate}</td>
                  <td className="px-3 py-2">{r.subject}</td>
                  <td className="px-3 py-2">{r.assessmentType}</td>
                  <td className="px-3 py-2">
                    {r.score != null ? `${r.score}${r.maxScore != null ? `/${r.maxScore}` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2">{r.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-medium">AI tutor sessions (summaries)</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No sessions yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
            {sessions.map((session) => {
              const acts = activities.filter((a) => a.sessionId === session.id);
              return (
                <li key={session.id} className="px-4 py-2">
                  <span className="font-medium">
                    {new Date(session.startedAt).toLocaleDateString()}
                  </span>{" "}
                  <span className="text-slate-500">
                    {acts.length === 0
                      ? "· conversation practice"
                      : "· " +
                        acts
                          .map(
                            (a) =>
                              `${a.activityType}${a.topic ? ` (${a.topic})` : ""}${
                                a.attempted ? ` ${a.correct ?? 0}/${a.attempted}` : ""
                              }`,
                          )
                          .join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Summaries only — conversation transcripts are not shown here.
        </p>
      </section>

      <section>
        <h2 className="font-medium">Goals</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center justify-between px-4 py-2">
              <span>
                {g.title}{" "}
                <span className="text-xs text-slate-400">· asked by {g.requestedByRole}</span>
              </span>
              <span className="text-xs text-slate-500">{g.status}</span>
            </li>
          ))}
          {goals.length === 0 ? <li className="px-4 py-2 text-slate-500">No goals yet.</li> : null}
        </ul>
        <form action={parentProposeGoalAction} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="studentId" value={id} />
          <input
            name="title"
            required
            placeholder={`Suggest a goal for ${name}…`}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Propose
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-medium">Work samples ({works.length})</h2>
        {works.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
            {works.map((w) => {
              const key = parseLocalUrl(w.fileUrl);
              return (
                <li key={w.id} className="flex items-center justify-between px-4 py-2">
                  <span>
                    {w.title ?? "Untitled"}{" "}
                    <span className="text-xs text-slate-400">
                      · {w.workType} · {w.source} · {w.workDate ?? "no date"}
                    </span>
                  </span>
                  {key ? (
                    <Link href={`/api/files/${key}`} target="_blank" className="text-teal-700 hover:underline">
                      view
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No work uploaded yet.</p>
        )}

        <details className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Upload work from home</summary>
          <form action={uploadWorkSampleAction} className="mt-3 grid grid-cols-2 gap-3">
            <input type="hidden" name="studentId" value={id} />
            <div className="col-span-2">
              <label className={label}>
                File (JPG, PNG, WebP, PDF — max 15 MB) *
                <input name="file" type="file" required accept=".jpg,.jpeg,.png,.webp,.pdf" className={field} />
              </label>
            </div>
            <label className={label}>
              Title / topic
              <input name="titleTopic" className={field} />
            </label>
            <label className={label}>
              Work type *
              <select name="workType" required className={field}>
                {s.workTypeInCore.enumValues.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Work date
              <input name="workDate" type="date" className={field} />
            </label>
            <div className="col-span-2">
              <button
                type="submit"
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Upload
              </button>
            </div>
          </form>
        </details>
      </section>

      <section>
        <h2 className="font-medium">Consents</h2>
        <p className="mt-1 text-sm text-slate-500">
          You can grant or withdraw each category at any time. Withdrawing takes effect
          immediately — e.g. withdrawing conversation storage stops new transcripts.
        </p>
        <ul className="mt-2 rounded-lg border border-slate-200 bg-white text-sm">
          {CONSENT_TYPES.map((type) => {
            const status = consents.get(type) ?? "not recorded";
            const granted = status === "granted";
            return (
              <li
                key={type}
                className="flex items-center justify-between border-b border-slate-100 px-4 py-2 last:border-0"
              >
                <span>{CONSENT_LABELS[type]}</span>
                <span className="flex items-center gap-3">
                  <span
                    className={
                      granted ? "text-green-600" : status === "withdrawn" ? "text-red-600" : "text-slate-400"
                    }
                  >
                    {status}
                  </span>
                  <form action={parentSetConsentAction}>
                    <input type="hidden" name="studentId" value={id} />
                    <input type="hidden" name="consentType" value={type} />
                    <input type="hidden" name="status" value={granted ? "withdrawn" : "granted"} />
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {granted ? "withdraw" : "grant"}
                    </button>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
