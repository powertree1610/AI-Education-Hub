import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { submitParentQuestionnaireAction } from "@/actions/forms";
import { InterestPicker, SubjectRatingsGrid, TraitInputs } from "@/components/questionnaire-fields";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Admin keys in the signed paper parent questionnaire (M3). */
export default async function ParentQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const subjects = await db.select().from(s.subjects).orderBy(s.subjects.name);
  const traits = await db.select().from(s.traits);
  const interests = await db.select().from(s.interests).orderBy(s.interests.name);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">
        Parent questionnaire — {student.fullName}
        <span className="ml-2 text-sm font-normal text-slate-500">(paper form entry)</span>
      </h1>
      <form action={submitParentQuestionnaireAction} className="mt-6 space-y-6">
        <input type="hidden" name="studentId" value={id} />
        <SubjectRatingsGrid subjects={subjects} legend="Parent's view of academic ability" />
        <InterestPicker interests={interests} legend="Interests (parent's view)" />
        <TraitInputs traits={traits} legend="Personality & behaviour at home" />
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700">
            Parent&apos;s main goal for the child
            <input
              name="goalText"
              placeholder="More confident reading aloud"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Anything else the parent noted
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
          Save questionnaire
        </button>
      </form>
    </div>
  );
}
