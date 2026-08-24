import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, getCurrentConsents } from "@platform/shared";
import { archiveReportAction, draftReportAction, publishReportAction } from "@/actions/reports";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";
import type { ReportDraft } from "@/lib/ai/report-draft";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const db = getDb();

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, { userId: user.id, role: "teacher", studentId: id });
    if (!allowed) redirect("/teacher");
  }

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const consents = await getCurrentConsents(db, id);
  const hasConsent = consents.get("progress_reports") === "granted";

  const reports = await db
    .select()
    .from(s.progressReports)
    .where(eq(s.progressReports.studentId, id))
    .orderBy(desc(s.progressReports.createdAt));

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Progress reports — {student.fullName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          The AI drafts, you edit and publish. Parents only ever see the published version.
        </p>
      </div>

      {hasConsent ? (
        <form
          action={draftReportAction}
          className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="studentId" value={id} />
          <label className={label}>
            Period
            <input name="period" required placeholder="Term 1 2026" className={field} />
          </label>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Draft with AI
          </button>
          <span className="pb-2 text-xs text-slate-400">(takes ~10s)</span>
        </form>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          progress_reports consent is not granted — reports cannot be drafted for this student.
        </p>
      )}

      <ul className="space-y-6">
        {reports.map((r) => {
          const draft = (r.draftContent ?? {}) as Partial<ReportDraft>;
          const content = (r.content ?? {}) as Partial<ReportDraft>;
          return (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.period}</span>
                <span
                  className={
                    r.status === "published"
                      ? "text-xs text-green-600"
                      : r.status === "pending_review"
                        ? "text-xs text-amber-600"
                        : "text-xs text-slate-400"
                  }
                >
                  {r.status}
                  {r.modelVersion ? ` · ${r.modelVersion}` : ""}
                </span>
              </div>

              {r.status === "pending_review" ? (
                <form action={publishReportAction} className="mt-3 space-y-3">
                  <input type="hidden" name="reportId" value={r.id} />
                  <label className={label}>
                    Summary (edit before publishing)
                    <textarea name="summary" rows={5} defaultValue={draft.summary ?? ""} className={field} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={label}>
                      Results trend
                      <input name="resultsTrend" defaultValue={draft.results_trend ?? ""} className={field} />
                    </label>
                    <label className={label}>
                      Goals achieved
                      <input
                        name="goalsAchieved"
                        type="number"
                        min={0}
                        defaultValue={draft.goals_achieved ?? 0}
                        className={field}
                      />
                    </label>
                  </div>
                  <label className={label}>
                    Highlights (one per line)
                    <textarea
                      name="highlights"
                      rows={3}
                      defaultValue={(draft.highlights ?? []).join("\n")}
                      className={field}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Publish to parent
                    </button>
                    <button
                      formAction={archiveReportAction}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Discard
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-2 space-y-2">
                  {content.summary ? <p className="whitespace-pre-wrap">{content.summary}</p> : null}
                  {content.results_trend ? (
                    <p className="text-slate-600">Results: {content.results_trend}</p>
                  ) : null}
                  {content.highlights?.length ? (
                    <ul className="list-inside list-disc text-slate-600">
                      {content.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
        {reports.length === 0 ? (
          <li className="text-sm text-slate-500">No reports yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
