import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { submitStudentInterviewAction } from "@/actions/forms";
import { InterestPicker } from "@/components/questionnaire-fields";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium text-slate-700";

/** Teacher-guided "student voice" interview — kid-friendly wording. */
export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoleOrRedirect("teacher", "admin");
  const { id } = await params;
  const db = getDb();

  const student = (await db.select().from(s.students).where(eq(s.students.id, id)).limit(1))[0];
  if (!student) notFound();

  const interests = await db.select().from(s.interests).orderBy(s.interests.name);
  const name = student.preferredName ?? student.fullName;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">Student interview — {name}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ask the questions in the student&apos;s words and write down what they actually say.
      </p>
      <form action={submitStudentInterviewAction} className="mt-6 space-y-6">
        <input type="hidden" name="studentId" value={id} />

        <InterestPicker interests={interests} legend={`Things ${name} likes`} />

        <section className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
          <label className={label}>
            Favourite game
            <input name="favourite_game" className={field} />
          </label>
          <label className={label}>
            Favourite character
            <input name="favourite_character" className={field} />
          </label>
          <label className={label}>
            Favourite topic
            <input name="favourite_topic" className={field} />
          </label>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className={label}>
            &quot;What am I good at?&quot;
            <input name="goodAt" className={field} />
          </label>
          <label className={label}>
            &quot;What is hard for me?&quot;
            <input name="findsHard" className={field} />
          </label>
          <label className={label}>
            &quot;What do I want to get better at?&quot; (becomes a proposed goal)
            <input name="wantToImprove" className={field} />
          </label>
          <label className={label}>
            &quot;How do I like to be helped?&quot;
            <input name="howToHelp" className={field} />
          </label>
          <label className={label}>
            &quot;Something I&apos;m proud of&quot;
            <input name="proudOf" className={field} />
          </label>
        </section>

        <button
          type="submit"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Save interview
        </button>
      </form>
    </div>
  );
}
