import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { endParentChatAction } from "@/actions/parent-chat";
import { ChatWindow } from "@/components/chat-window";
import { getDb } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { isChildOfGuardianUser } from "@/lib/parents";

export const dynamic = "force-dynamic";

/** Parent AI chat (v6) — the guardian's own active session about their child. */
export default async function ParentChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireRoleOrRedirect("guardian");
  const { sessionId } = await params;
  const db = getDb();

  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session || session.startedBy !== user.id || session.sessionKind !== "parent") notFound();

  const { ok } = await isChildOfGuardianUser(db, user.id, session.studentId);
  if (!ok) notFound();

  const student = (
    await db.select().from(s.students).where(eq(s.students.id, session.studentId)).limit(1)
  )[0];
  if (!student) notFound();
  const name = student.preferredName ?? student.fullName;

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Ask AI about {name}</h1>
          <p className="text-xs text-slate-500">
            Answers come from {name}&apos;s teacher-approved profile and goals — the AI cannot see
            their private chats. This conversation is not saved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/parent/children/${session.studentId}`}
            className="text-sm text-slate-500 hover:underline"
          >
            ← Back
          </Link>
          <form action={endParentChatAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              End chat
            </button>
          </form>
        </div>
      </header>
      <ChatWindow
        chatId={sessionId}
        endpoint="/api/parent/chat"
        payloadKey="sessionId"
        initialMessages={[]}
      />
    </div>
  );
}
