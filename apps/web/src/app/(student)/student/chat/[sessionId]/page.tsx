import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { endStudentSessionAction } from "@/actions/student-sessions";
import { ChatWindow } from "@/components/chat-window";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { studentForUser } from "@/lib/student";

export const dynamic = "force-dynamic";

/** Home Mode chat — the student's own active session (Talk or Learn). */
export default async function StudentChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRoleOrRedirect("student");
  const student = await studentForUser(user.id);
  if (!student) notFound();

  const { sessionId } = await params;
  const db = getDb();
  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session || session.startedBy !== user.id || session.studentId !== student.id) notFound();

  const daily = session.sessionKind === "daily";
  const started = new Date(session.startedAt).getTime();
  const minutes = student.maxSessionMinutes ?? 45;
  const minutesLeft = Math.max(0, Math.round(minutes - (Date.now() - started) / 60_000));

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h1
          className="text-2xl font-bold text-teal-800"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {daily ? "💬 Let's talk!" : "📚 Let's learn!"}
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">~{minutesLeft} min left</span>
          <form action={endStudentSessionAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-xs text-slate-500 hover:bg-white"
            >
              I&apos;m done 👋
            </button>
          </form>
        </div>
      </header>
      <ChatWindow
        chatId={sessionId}
        endpoint="/api/student/chat"
        payloadKey="sessionId"
        variant="kid"
        initialMessages={[]}
      />
    </div>
  );
}
