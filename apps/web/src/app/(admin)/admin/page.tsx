import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const res = await getDb().execute(query);
  return Number((res.rows[0] as { n: string | number }).n);
}

function StatCard({
  label,
  value,
  icon,
  warn,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  icon: string;
  warn?: boolean;
  href?: string;
  hint?: string;
}) {
  const ok = !warn;
  const inner = (
    <div
      className={`group flex h-full items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition ${
        warn
          ? "border-amber-300 bg-amber-50/50"
          : "border-slate-200"
      } ${href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
          warn ? "bg-amber-100" : "bg-teal-50"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={`block text-2xl font-semibold leading-tight ${warn ? "text-amber-700" : "text-slate-800"}`}>
          {value}
          {ok && typeof value === "number" && value === 0 && hint ? (
            <span className="ml-2 align-middle text-xs font-normal text-teal-700">{hint}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">
          {label}
          {href ? (
            <span className="ml-1 text-teal-700 opacity-0 transition group-hover:opacity-100">→</span>
          ) : null}
        </span>
      </span>
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

  const unreviewedSafety = await scalar(sql`
    select count(*)::int as n from core.safety_events where reviewed_at is null
  `);

  // All-time totals are the headline; this month rides along for context.
  const usage = await getDb().execute(sql`
    select coalesce(sum(total_tokens),0)::bigint as tokens,
           coalesce(sum(estimated_cost),0)::numeric(12,4) as cost,
           coalesce(sum(total_tokens) filter (where created_at >= date_trunc('month', now())),0)::bigint as month_tokens,
           coalesce(sum(estimated_cost) filter (where created_at >= date_trunc('month', now())),0)::numeric(12,4) as month_cost,
           min(created_at) as since
    from core.ai_usage_logs
  `);
  const u = usage.rows[0] as {
    tokens: string;
    cost: string;
    month_tokens: string;
    month_cost: string;
    since: string | null;
  };
  const totalTokens = Number(u.tokens);
  const totalCost = Number(u.cost);
  const monthTokens = Number(u.month_tokens);
  const monthCost = Number(u.month_cost);

  const usageByType = await getDb().execute(sql`
    select usage_type as name, count(*)::int as calls, sum(total_tokens)::bigint as tokens,
           sum(estimated_cost)::numeric(12,4) as cost
    from core.ai_usage_logs
    group by usage_type order by sum(total_tokens) desc
  `);
  const usageByModel = await getDb().execute(sql`
    select model as name, count(*)::int as calls, sum(total_tokens)::bigint as tokens,
           sum(estimated_cost)::numeric(12,4) as cost
    from core.ai_usage_logs
    group by model order by sum(total_tokens) desc
  `);

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Collection health at a glance — amber cards need someone&apos;s attention.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon="🎓" label="Active students" value={activeStudents} href="/admin/students" />
        <StatCard
          icon="📋"
          label="Students with consent gaps"
          value={consentGaps}
          warn={consentGaps > 0}
          href="/admin/students"
          hint="all clear"
        />
        <StatCard
          icon="📝"
          label="Missing teacher baseline"
          value={missingBaseline}
          warn={missingBaseline > 0}
          href="/admin/students"
          hint="all clear"
        />
        <StatCard
          icon="🗂️"
          label="Portfolio below 3 items"
          value={thinPortfolio}
          warn={thinPortfolio > 0}
          href="/admin/students"
          hint="all clear"
        />
        <StatCard
          icon="🔍"
          label="Pending AI reviews"
          value={pendingReviews}
          href="/teacher/review"
          warn={pendingReviews > 0}
          hint="queue empty"
        />
        <StatCard
          icon="🛡️"
          label="Unreviewed safety events"
          value={unreviewedSafety}
          href="/admin/safety"
          warn={unreviewedSafety > 0}
          hint="all reviewed"
        />
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">
            AI usage — all time: {fmtTokens(totalTokens)} tokens · ${totalCost.toFixed(2)}
          </h2>
          <span className="text-xs text-slate-400">
            this month: {fmtTokens(monthTokens)} tokens · ${monthCost.toFixed(2)}
            {u.since ? ` · tracking since ${new Date(u.since).toLocaleDateString()}` : ""}
          </span>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <UsageMeterList title="Usage by model" rows={usageByModel.rows as unknown as UsageRow[]} />
          <UsageMeterList title="Usage by feature" rows={usageByType.rows as unknown as UsageRow[]} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Cost depends on the model, not just tokens — the same tokens on gpt-5.4-mini cost
          more than on deepseek-v4-flash, which is why the two views can rank differently.
        </p>
      </section>
    </div>
  );
}

interface UsageRow {
  name: string;
  calls: number;
  tokens: string;
  cost: string;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Meter list: one measure (tokens) → one hue; values printed in ink, the bar
 *  only carries magnitude. */
function UsageMeterList({ title, rows }: { title: string; rows: UsageRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.tokens)));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-slate-600">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No usage recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => {
            const tokens = Number(row.tokens);
            return (
              <li key={row.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {row.calls} request{row.calls === 1 ? "" : "s"}
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <span className="block font-semibold leading-tight">{fmtTokens(tokens)}</span>
                    <span className="block text-xs leading-tight text-slate-400">
                      ${Number(row.cost).toFixed(4)}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${Math.max(2, (tokens / max) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
