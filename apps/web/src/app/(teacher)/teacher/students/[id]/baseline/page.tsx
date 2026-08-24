import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { submitTeacherBaselineAction } from "@/actions/forms";
import { SubjectRatingsGrid, TraitInputs } from "@/components/questionnaire-fields";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEV_AREAS = ["confidence", "concentration", "resilience", "independence", "motivation"];

export default async function BaselinePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const db = getDb();

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const subjects = await db.select().from(s.subjects).orderBy(s.subjects.name);
  const traits = await db.select().from(s.traits);

  const scale = (name: string) => (
    <select name={name} defaultValue="" className="rounded border border-slate-300 px-2 py-1 text-xs">
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">Teacher baseline — {student.fullName}</h1>
      <form action={submitTeacherBaselineAction} className="mt-6 space-y-6">
        <input type="hidden" name="studentId" value={id} />
        <SubjectRatingsGrid subjects={subjects} legend="Academic baseline per subject" />

        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Initial levels (1–5, optional)</h2>
          <p className="text-xs text-slate-500">
            These write directly to the live profile as teacher-set baseline levels
            (append-only history).
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {subjects.map((subject) => (
              <label key={subject.id} className="flex items-center justify-between gap-2">
                <span>{subject.name} (overall skill)</span>
                {scale(`skill_${subject.id}`)}
              </label>
            ))}
            {DEV_AREAS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-2">
                <span className="capitalize">{key} (development)</span>
                {scale(`level_${key}`)}
              </label>
            ))}
          </div>
        </section>

        <TraitInputs traits={traits} legend="Behaviour & communication at the centre" />

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700">
            Priority goal for this student (created as an active goal)
            <input
              name="goalText"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Learning preferences / notes
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save baseline
        </button>
      </form>
    </div>
  );
}
