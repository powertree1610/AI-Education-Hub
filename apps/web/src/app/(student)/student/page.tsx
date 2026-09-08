import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/** Placeholder home (Phase 2) — the Talk/Learn session buttons arrive with
 *  Home Mode (Phase 3, after the DDL pack is applied). */
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

  const name = student.preferredName ?? student.fullName;
  return (
    <div className="mt-10 text-center">
      <h1 className="text-3xl font-bold text-teal-800" style={{ fontFamily: "var(--font-display)" }}>
        Hi {name}! 👋
      </h1>
      <p className="mt-3 text-slate-600">
        Chatting from home is coming very soon. For now, your AI buddy is at the centre kiosk.
      </p>
    </div>
  );
}
