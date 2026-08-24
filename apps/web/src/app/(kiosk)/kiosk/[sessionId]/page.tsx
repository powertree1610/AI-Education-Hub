import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { endSessionAction } from "@/actions/sessions";
import { ChatWindow } from "@/components/chat-window";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { signInPath } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * Student kiosk: locked-down chrome (no portal nav), runs under the
 * supervising teacher's login on the centre device.
 */
export default async function KioskPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await currentAppUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) redirect(signInPath());

  const { sessionId } = await params;
  const db = getDb();

  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session) notFound();

  const student = (
    await db.select().from(s.students).where(eq(s.students.id, session.studentId)).limit(1)
  )[0];
  if (!student) notFound();

  const name = student.preferredName ?? student.fullName;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo-700">Hi {name}! 👋</h1>
        <form action={endSessionAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
          >
            End session (teacher)
          </button>
        </form>
      </header>
      <ChatWindow
        chatId={sessionId}
        endpoint="/api/kiosk/chat"
        payloadKey="sessionId"
        initialMessages={[]}
      />
    </div>
  );
}
