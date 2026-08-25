import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { SAFEGUARDING_STATUSES } from "@platform/shared";
import { addReviewAction, updateCaseStatusAction } from "@/actions/safeguarding";
import { getDb } from "@/lib/db";
import { requireSafeguardingLead } from "@/lib/guard";
import { isUuid, sourceLabel } from "@/lib/safeguarding-labels";

export const dynamic = "force-dynamic";

interface CaseDetail {
  id: string;
  student_id: string;
  source: string;
  status: string;
  occurred_at: string;
  created_at: string;
  factual_record: string;
  ai_flag_reason: string | null;
  ai_confidence: string | null;
  session_ref: string | null;
  safety_event_id: string | null;
  full_name: string;
  student_code: string;
  creator_name: string | null;
}

interface LinkedEvent {
  surface: string;
  category: string;
  severity: number;
  action_taken: string;
  excerpt: string | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  decision: string;
  action_taken: string | null;
  follow_up: string | null;
  reviewed_at: string;
  reviewer_name: string;
}

export default async function SafeguardingCasePage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  await requireSafeguardingLead();
  const { recordId } = await params;
  if (!isUuid(recordId)) notFound();
  const db = getDb();

  const [caseRes, reviewsRes] = await Promise.all([
    db.execute(sql`
      select r.id, r.student_id, r.source, r.status, r.occurred_at, r.created_at,
             r.factual_record, r.ai_flag_reason, r.ai_confidence, r.session_ref,
             r.safety_event_id, st.full_name, st.student_code, cu.name as creator_name
      from restricted.safeguarding_records r
      join core.students st on st.id = r.student_id
      left join core.users cu on cu.id = r.created_by
      where r.id = ${recordId}
      limit 1
    `),
    db.execute(sql`
      select v.id, v.decision, v.action_taken, v.follow_up, v.reviewed_at, u.name as reviewer_name
      from restricted.safeguarding_reviews v
      join core.users u on u.id = v.reviewed_by
      where v.record_id = ${recordId}
      order by v.reviewed_at desc
    `),
  ]);
  const record = caseRes.rows[0] as unknown as CaseDetail | undefined;
  if (!record) notFound();
  const reviews = reviewsRes.rows as unknown as ReviewRow[];

  const eventRes = record.safety_event_id
    ? await db.execute(sql`
        select surface, category, severity, action_taken, excerpt, created_at
        from core.safety_events where id = ${record.safety_event_id} limit 1
      `)
    : null;
  const event = (eventRes?.rows[0] ?? null) as LinkedEvent | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {record.full_name} <span className="text-sm font-normal text-slate-400">{record.student_code}</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {sourceLabel(record.source)} · occurred {new Date(record.occurred_at).toLocaleString()} ·
          recorded {new Date(record.created_at).toLocaleString()}
          {record.creator_name ? ` by ${record.creator_name}` : ""}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-600">Factual record</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">{record.factual_record}</p>
        {record.ai_flag_reason && (
          <p className="mt-3 text-xs text-slate-500">
            AI flag reason: {record.ai_flag_reason}
            {record.ai_confidence ? ` (confidence ${Number(record.ai_confidence).toFixed(2)})` : ""}
          </p>
        )}
      </section>

      {event && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-800">Linked safety event</h2>
          <p className="mt-2 text-sm text-amber-900">
            {event.surface.replace("_", " ")} · {event.category.replace(/_/g, " ")} · severity{" "}
            {event.severity}/5 · action: {event.action_taken.replace("_", " ")}
          </p>
          {event.excerpt && (
            <p className="mt-2 text-sm text-amber-900/80">
              Excerpt: <span className="italic">“{event.excerpt}”</span>
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-600">Status</h2>
          <form action={updateCaseStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="recordId" value={record.id} />
            <select
              name="status"
              defaultValue={record.status}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {SAFEGUARDING_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace("_", " ")}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white hover:bg-teal-800">
              Update
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-600">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No reviews yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{r.decision}</span>
                  <span className="text-xs text-slate-400">
                    {r.reviewer_name} · {new Date(r.reviewed_at).toLocaleString()}
                  </span>
                </div>
                {r.action_taken && <p className="mt-1">Action: {r.action_taken}</p>}
                {r.follow_up && <p className="mt-1 text-slate-600">Follow-up: {r.follow_up}</p>}
              </li>
            ))}
          </ul>
        )}

        <form action={addReviewAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <input type="hidden" name="recordId" value={record.id} />
          <input
            name="decision"
            required
            placeholder="Decision (e.g. monitoring, referred to counsellor)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="actionTaken"
            rows={2}
            placeholder="Action taken"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="followUp"
            rows={2}
            placeholder="Follow-up (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            Add review
          </button>
        </form>
      </section>
    </div>
  );
}
