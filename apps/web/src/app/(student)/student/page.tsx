import Link from "next/link";
import { startStudentSessionAction } from "@/actions/student-sessions";
import { checkConsent } from "@platform/shared";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/** Student home (Home Mode): Talk = Daily Chat, Learn = Academic Support. */
export default async function StudentHomePage() {
  const user = await requireRoleOrRedirect("student");
  const student = await studentForUser(user.id);

  if (!student) {
    return (
      <p className="mt-10 text-center text-lg text-slate-600">
        Your account isn&apos;t linked yet — please ask your teacher. 🙂
      </p>
    );
  }

  const { granted } = await checkConsent(getDb(), student.id, ["ai_interaction"]);
  const enabled = student.unsupervisedAccessEnabled && granted && student.status === "active";
  const reason = !student.unsupervisedAccessEnabled
    ? "Chatting from home isn't switched on yet — ask your teacher!"
    : !granted
      ? "AI chat permission hasn't been given yet — ask your parents or teacher!"
      : student.status !== "active"
        ? "Your account isn't active right now — ask your teacher."
        : null;

  const name = student.preferredName ?? student.fullName;
  const btn =
    "w-full rounded-3xl px-6 py-8 text-2xl font-bold shadow-md transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100";

  return (
    <div className="mt-8 text-center">
      <h1 className="text-3xl font-bold text-teal-800" style={{ fontFamily: "var(--font-display)" }}>
        Hi {name}! 👋
      </h1>
      <p className="mt-2 text-slate-600">What would you like to do today?</p>

      <div className="mx-auto mt-8 grid max-w-md gap-5">
        <form action={startStudentSessionAction}>
          <input type="hidden" name="kind" value="daily" />
          <button disabled={!enabled} className={`${btn} bg-amber-200 text-amber-900`}>
            💬 Talk
            <span className="mt-1 block text-sm font-normal">Chat about your day and ideas</span>
          </button>
        </form>
        {enabled ? (
          <Link href="/student/learn" className={`${btn} block bg-teal-600 text-white`}>
            📚 Learn
            <span className="mt-1 block text-sm font-normal">
              Your tasks, homework help and revision
            </span>
          </Link>
        ) : (
          <button disabled className={`${btn} bg-teal-600 text-white`}>
            📚 Learn
            <span className="mt-1 block text-sm font-normal">
              Your tasks, homework help and revision
            </span>
          </button>
        )}
        <Link
          href="/student/goals"
          className="rounded-3xl border border-slate-200 bg-white/70 px-6 py-4 text-lg font-semibold text-slate-700 shadow-sm hover:bg-white"
        >
          ⭐ My goals
        </Link>
      </div>

      {reason ? <p className="mt-6 text-sm text-slate-500">{reason}</p> : null}
      {enabled && student.maxSessionMinutes ? (
        <p className="mt-6 text-xs text-slate-400">
          Each chat lasts up to {student.maxSessionMinutes} minutes.
        </p>
      ) : null}
    </div>
  );
}
