import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema as s } from "@platform/db";
import { markSafetyEventReviewedAction } from "@/actions/safeguarding";
import { getDb } from "@/lib/db";

/**
 * Shared safety-events queue — rendered in the admin shell (/admin/safety)
 * and the lead shell (/safeguarding/events). Unreviewed first, worst first.
 */
export async function SafetyEventsQueue({ backPath }: { backPath: "/admin/safety" | "/safeguarding/events" }) {
  const reviewer = alias(s.users, "reviewer");
  const rows = await getDb()
    .select({
      id: s.safetyEvents.id,
      createdAt: s.safetyEvents.createdAt,
      surface: s.safetyEvents.surface,
      category: s.safetyEvents.category,
      severity: s.safetyEvents.severity,
      actionTaken: s.safetyEvents.actionTaken,
      excerpt: s.safetyEvents.excerpt,
      escalated: s.safetyEvents.escalatedToSafeguarding,
      reviewedAt: s.safetyEvents.reviewedAt,
      reviewerName: reviewer.name,
      studentName: s.students.fullName,
      studentCode: s.students.studentCode,
    })
    .from(s.safetyEvents)
    .innerJoin(s.students, eq(s.students.id, s.safetyEvents.studentId))
    .leftJoin(reviewer, eq(reviewer.id, s.safetyEvents.reviewedBy))
    .orderBy(
      sql`(${s.safetyEvents.reviewedAt} is null) desc`,
      desc(s.safetyEvents.severity),
      desc(s.safetyEvents.createdAt),
    )
    .limit(200);

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">Safety events</h1>
      <p className="mt-1 text-sm text-slate-500">
        Content flagged by the kiosk safety filter. Escalated events also opened a safeguarding
        case, visible to the safeguarding lead.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No safety events recorded.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Surface</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Excerpt</th>
              <th className="py-2 text-right">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  <span className="font-medium">{e.studentName}</span>{" "}
                  <span className="text-xs text-slate-400">{e.studentCode}</span>
                </td>
                <td className="py-2 pr-3">{e.surface.replace("_", " ")}</td>
                <td className="py-2 pr-3">
                  {e.category.replace(/_/g, " ")}
                  {e.escalated && (
                    <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      escalated
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      e.severity >= 4
                        ? "bg-red-100 text-red-700"
                        : e.severity >= 3
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {e.severity}/5
                  </span>
                </td>
                <td className="py-2 pr-3">{e.actionTaken.replace("_", " ")}</td>
                <td className="max-w-56 py-2 pr-3 text-slate-500">
                  {e.excerpt ? (
                    <span className="line-clamp-2 italic">“{e.excerpt}”</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {e.reviewedAt ? (
                    <span className="text-xs text-slate-400">
                      {e.reviewerName ?? "reviewed"} ·{" "}
                      {new Date(e.reviewedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <form action={markSafetyEventReviewedAction}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <input type="hidden" name="backPath" value={backPath} />
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                        Mark reviewed
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
