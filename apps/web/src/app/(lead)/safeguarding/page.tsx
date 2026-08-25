import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CaseRow {
  id: string;
  source: string;
  status: string;
  occurred_at: string;
  created_at: string;
  full_name: string;
  student_code: string;
}

const SOURCE_LABELS: Record<string, string> = {
  student_statement: "Student statement",
  teacher_observation: "Teacher referral",
  parent_info: "Parent information",
  ai_flag: "AI flag",
  admin_report: "Admin report",
  content_safety_escalation: "Content safety escalation",
};

function StatusChip({ status }: { status: string }) {
  const open = status === "open" || status === "under_review" || status === "escalated";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        open ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default async function SafeguardingCasesPage() {
  const res = await getDb().execute(sql`
    select r.id, r.source, r.status, r.occurred_at, r.created_at, st.full_name, st.student_code
    from restricted.safeguarding_records r
    join core.students st on st.id = r.student_id
    order by (r.status in ('open','under_review','escalated')) desc, r.created_at desc
    limit 200
  `);
  const cases = res.rows as unknown as CaseRow[];

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold">Safeguarding cases</h1>
      <p className="mt-1 text-sm text-slate-500">
        Case content is restricted to the safeguarding lead. Handle per the centre&apos;s
        safeguarding procedure.
      </p>
      {cases.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No cases recorded.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Occurred</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 pr-3">
                  <span className="font-medium">{c.full_name}</span>{" "}
                  <span className="text-xs text-slate-400">{c.student_code}</span>
                </td>
                <td className="py-2 pr-3">{SOURCE_LABELS[c.source] ?? c.source}</td>
                <td className="py-2 pr-3 text-slate-500">
                  {new Date(c.occurred_at).toLocaleDateString()}
                </td>
                <td className="py-2 pr-3">
                  <StatusChip status={c.status} />
                </td>
                <td className="py-2 text-right">
                  <Link className="text-teal-700 hover:underline" href={`/safeguarding/${c.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
