import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { createChatAction } from "@/actions/chats";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChatIndexPage() {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const db = getDb();

  const chats = await db
    .select({
      id: s.agentChats.id,
      title: s.agentChats.title,
      updatedAt: s.agentChats.updatedAt,
      studentName: s.students.fullName,
    })
    .from(s.agentChats)
    .leftJoin(s.students, eq(s.students.id, s.agentChats.studentId))
    .where(eq(s.agentChats.userId, user.id))
    .orderBy(desc(s.agentChats.updatedAt))
    .limit(30);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI Chat</h1>
        <form action={createChatAction}>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New chat
          </button>
        </form>
      </div>
      {chats.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No chats yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/teacher/chat/${chat.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="font-medium">{chat.title ?? "Untitled chat"}</span>
                <span className="text-xs text-slate-400">
                  {chat.studentName ? `${chat.studentName} · ` : ""}
                  {new Date(chat.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
