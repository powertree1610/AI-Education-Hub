import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const res = await getDb().execute(query);
  return Number((res.rows[0] as { n: string | number }).n);
}

function StatCard({ label, value, warn, href }: { label: string; value: string | number; warn?: boolean; href?: string }) {
  const inner = (
    <div className={`rounded-lg border bg-white p-4 ${warn ? "border-amber-300" : "border-slate-200"}`}>
      <div className={`text-2xl font-semibold ${warn ? "text-amber-600" : ""}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Admin ops dashboard (M10): collection health + AI spend. */
export default async function AdminDashboard() {
  const activeStudents = await scalar(sql`select count(*)::int as n from core.students where status='active'`);

  // A student "has consent gaps" when any of the three operating essentials
  // is not currently granted.
  const consentGaps = await scalar(sql`
    select count(*)::int as n from core.students st
    where st.status='active' and exists (
      select 1 from unnest(array['basic_profile','work_uploads','ai_interaction']) as t(ct)
      where not exists (
        select 1 from core.v_current_consents c
        where c.student_id = st.id and c.consent_type = t.ct::core.consent_type and c.status = 'granted'))
  `);

  const missingBaseline = await scalar(sql`
    select count(*)::int as n from core.students st
    where st.status='active' and not exists (
      select 1 from core.form_submissions f
      where f.student_id = st.id and f.form_type = 'teacher_baseline')
  `);

  const thinPortfolio = await scalar(sql`
    select count(*)::int as n from core.students st
    where st.status='active'
      and (select count(*) from core.work_samples w where w.student_id = st.id) < 3
  `);

  const pendingReviews = await scalar(sql`
    select ((select count(*) from core.work_analyses where review_status='pending_review')
          + (select count(*) from core.observations where status='unverified'))::int as n
  `);

  const usage = await getDb().execute(sql`
    select coalesce(sum(total_tokens),0)::bigint as tokens,
           coalesce(sum(estimated_cost),0)::numeric(12,4) as cost
    from core.ai_usage_logs
    where created_at >= date_trunc('month', now())
  `);
  const monthTokens = Number((usage.rows[0] as { tokens: string }).tokens);
  const monthCost = Number((usage.rows[0] as { cost: string }).cost);

  const usageByType = await getDb().execute(sql`
    select usage_type, count(*)::int as calls, sum(total_tokens)::bigint as tokens,
           sum(estimated_cost)::numeric(12,4) as cost
    from core.ai_usage_logs
    where created_at >= date_trunc('month', now())
    group by usage_type order by sum(total_tokens) desc
  `);

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Active students" value={activeStudents} href="/admin/students" />
        <StatCard label="Students with consent gaps" value={consentGaps} warn={consentGaps > 0} />
        <StatCard label="Missing teacher baseline" value={missingBaseline} warn={missingBaseline > 0} />
        <StatCard label="Portfolio below 3 items" value={thinPortfolio} warn={thinPortfolio > 0} />
        <StatCard label="Pending AI reviews" value={pendingReviews} href="/teacher/review" warn={pendingReviews > 0} />
      </div>

      <section>
        <h2 className="font-medium">
          AI usage this month — {(monthTokens / 1000).toFixed(1)}k tokens · ${monthCost.toFixed(2)}
        </h2>
        <table className="mt-2 w-full max-w-lg rounded-lg border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Feature</th>
              <th className="px-3 py-2 font-medium">Calls</th>
              <th className="px-3 py-2 font-medium">Tokens</th>
              <th className="px-3 py-2 font-medium">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {(usageByType.rows as { usage_type: string; calls: number; tokens: string; cost: string }[]).map(
              (row) => (
                <tr key={row.usage_type} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">{row.usage_type}</td>
                  <td className="px-3 py-2">{row.calls}</td>
                  <td className="px-3 py-2">{Number(row.tokens).toLocaleString()}</td>
                  <td className="px-3 py-2">${Number(row.cost).toFixed(4)}</td>
                </tr>
              ),
            )}
            {usageByType.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-2 text-slate-500">
                  No AI usage this month.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
