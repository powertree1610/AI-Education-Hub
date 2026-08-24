import { and, desc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { listAccessibleStudentIds, type ProposedChange, type WorkAnalysisFindings } from "@platform/shared";
import { reviewObservationAction, reviewWorkAnalysisAction } from "@/actions/reviews";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const db = getDb();

  let studentScope: string[] | null = null; // null = all (admin)
  if (user.role === "teacher") {
    studentScope = await listAccessibleStudentIds(db, user.id);
    if (studentScope.length === 0) studentScope = ["00000000-0000-0000-0000-000000000000"];
  }

  const pendingAnalyses = await db
    .select({
      id: s.workAnalyses.id,
      findings: s.workAnalyses.findings,
      suggestedNextActivity: s.workAnalyses.suggestedNextActivity,
      confidence: s.workAnalyses.confidence,
      analyzedAt: s.workAnalyses.analyzedAt,
      title: s.workSamples.titleTopic,
      studentId: s.workSamples.studentId,
      studentName: s.students.fullName,
    })
    .from(s.workAnalyses)
    .innerJoin(s.workSamples, eq(s.workSamples.id, s.workAnalyses.workSampleId))
    .innerJoin(s.students, eq(s.students.id, s.workSamples.studentId))
    .where(
      and(
        eq(s.workAnalyses.reviewStatus, "pending_review"),
        ...(studentScope ? [inArray(s.workSamples.studentId, studentScope)] : []),
      ),
    )
    .orderBy(desc(s.workAnalyses.analyzedAt));

  const observationRows = await db
    .select({
      id: s.observations.id,
      category: s.observations.category,
      statement: s.observations.statement,
      confidence: s.observations.confidence,
      proposedChange: s.observations.proposedChange,
      status: s.observations.status,
      createdAt: s.observations.createdAt,
      studentName: s.students.fullName,
    })
    .from(s.observations)
    .innerJoin(s.students, eq(s.students.id, s.observations.studentId))
    .where(
      and(
        eq(s.observations.status, "unverified"),
        ...(studentScope ? [inArray(s.observations.studentId, studentScope)] : []),
      ),
    )
    .orderBy(desc(s.observations.createdAt));

  const pendingObservations = observationRows;
  const trulyPendingAnalyses = pendingAnalyses;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Review Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nothing the AI writes touches a student&apos;s live profile until you approve it here.
        </p>
      </div>

      <section>
        <h2 className="font-medium">AI work analyses awaiting review</h2>
        {trulyPendingAnalyses.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None pending.</p>
        ) : (
          <ul className="mt-2 space-y-4">
            {trulyPendingAnalyses.map((a) => {
              const findings = a.findings as unknown as WorkAnalysisFindings;
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {a.studentName} — {a.title ?? "Untitled work"}
                    </span>
                    <span className="text-xs text-slate-400">
                      confidence {a.confidence ?? "—"} · {new Date(a.analyzedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <div>
                      <dt className="font-medium text-green-700">Strengths</dt>
                      <dd>{findings?.strengths?.join("; ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-amber-700">Improvements</dt>
                      <dd>{findings?.improvements?.join("; ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-red-700">Recurring mistakes</dt>
                      <dd>{findings?.recurring_mistakes?.join("; ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-600">Suggested next</dt>
                      <dd>{a.suggestedNextActivity ?? "—"}</dd>
                    </div>
                  </dl>
                  <form action={reviewWorkAnalysisAction} className="mt-3 flex items-center gap-2">
                    <input type="hidden" name="analysisId" value={a.id} />
                    <input
                      name="notes"
                      placeholder="Reviewer notes (optional)"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      name="decision"
                      value="confirmed"
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Confirm
                    </button>
                    <button
                      name="decision"
                      value="partial"
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Partial
                    </button>
                    <button
                      name="decision"
                      value="rejected"
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Reject
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">AI observations awaiting review</h2>
        {pendingObservations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None pending.</p>
        ) : (
          <ul className="mt-2 space-y-4">
            {pendingObservations.map((o) => {
              const change = o.proposedChange as ProposedChange | null;
              return (
                <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{o.studentName}</span>
                    <span className="text-xs text-slate-400">
                      {o.category} · confidence {o.confidence ?? "—"}
                    </span>
                  </div>
                  <p className="mt-1">{o.statement}</p>
                  {change ? (
                    <p className="mt-2 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-800">
                      Proposed change: {change.target} · {change.key} : {String(change.from ?? "?")} →{" "}
                      {String(change.to ?? "?")}
                      {change.target !== "student_levels"
                        ? " (applied manually — only level changes auto-apply in v1)"
                        : " (applies on approval)"}
                    </p>
                  ) : null}
                  <form action={reviewObservationAction} className="mt-3 flex items-center gap-2">
                    <input type="hidden" name="observationId" value={o.id} />
                    <input
                      name="comments"
                      placeholder="Comments (optional)"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      name="decision"
                      value="approved"
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Approve
                    </button>
                    <button
                      name="decision"
                      value="partially_approved"
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Partial
                    </button>
                    <button
                      name="decision"
                      value="monitoring"
                      className="rounded-md bg-slate-500 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Keep observing
                    </button>
                    <button
                      name="decision"
                      value="rejected"
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Reject
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
