import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent } from "@platform/shared";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import {
  buildTimeline,
  TIMELINE_TYPE_LABELS,
  type TimelineEventType,
} from "@/lib/timeline";

export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<TimelineEventType, string> = {
  level: "bg-teal-100 text-teal-800",
  observation: "bg-indigo-100 text-indigo-800",
  goal: "bg-amber-100 text-amber-800",
  result: "bg-sky-100 text-sky-800",
  work: "bg-slate-200 text-slate-700",
  report: "bg-emerald-100 text-emerald-800",
  form: "bg-purple-100 text-purple-800",
  material: "bg-orange-100 text-orange-800",
};

/** Development timeline (v7): the child's whole recorded journey, one list. */
export default async function StudentTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const { type } = await searchParams;
  const db = getDb();

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, { userId: user.id, role: "teacher", studentId: id });
    if (!allowed) redirect("/teacher");
  }

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const all = await buildTimeline(db, id, "staff");
  const activeType =
    type && type in TIMELINE_TYPE_LABELS ? (type as TimelineEventType) : null;
  const events = activeType ? all.filter((e) => e.type === activeType) : all;

  const counts = new Map<TimelineEventType, number>();
  for (const e of all) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Development timeline{" "}
            <span className="text-base font-normal text-slate-500">
              · {student.preferredName ?? student.fullName}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything recorded about {student.preferredName ?? student.fullName}&apos;s journey,
            newest first. The profile is the summary; this is the story behind it.
          </p>
        </div>
        <Link
          href={`/teacher/students/${id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ← Student page
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={`/teacher/students/${id}/timeline`}
          className={`rounded-full border px-3 py-1 ${activeType === null ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          All ({all.length})
        </Link>
        {(Object.keys(TIMELINE_TYPE_LABELS) as TimelineEventType[]).map((t) =>
          counts.get(t) ? (
            <Link
              key={t}
              href={`/teacher/students/${id}/timeline?type=${t}`}
              className={`rounded-full border px-3 py-1 ${activeType === t ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {TIMELINE_TYPE_LABELS[t]} ({counts.get(t)})
            </Link>
          ) : null,
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing recorded yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-6">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{e.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_STYLES[e.type]}`}>
                      {TIMELINE_TYPE_LABELS[e.type]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(e.at).toLocaleDateString()}
                    </span>
                  </span>
                </div>
                {e.detail ? <p className="mt-1 text-xs text-slate-500">{e.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
