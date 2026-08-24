import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { ChatWindow, type DisplayMessage } from "@/components/chat-window";
import type { ChatMessage, ToolCall } from "@/lib/ai/central-api";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function toDisplay(rows: { content: unknown }[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  for (const row of rows) {
    const msg = row.content as ChatMessage;
    if (msg.role === "user" && typeof msg.content === "string") {
      out.push({ role: "user", text: msg.content });
    } else if (msg.role === "assistant") {
      for (const tc of msg.tool_calls ?? []) {
        out.push({ role: "tool_note", text: `⚙ ${(tc as ToolCall).function.name} ✓` });
      }
      if (typeof msg.content === "string" && msg.content.trim()) {
        out.push({ role: "assistant", text: msg.content });
      }
    }
    // tool-result rows are internal replay state, not displayed
  }
  return out;
}

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const { chatId } = await params;
  const db = getDb();

  const chat = (
    await db.select().from(s.agentChats).where(eq(s.agentChats.id, chatId)).limit(1)
  )[0];
  if (!chat || chat.userId !== user.id) notFound();

  const rows = await db
    .select({ content: s.agentChatMessages.content })
    .from(s.agentChatMessages)
    .where(eq(s.agentChatMessages.chatId, chatId))
    .orderBy(asc(s.agentChatMessages.createdAt));

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">{chat.title ?? "New chat"}</h1>
      <ChatWindow chatId={chatId} endpoint="/api/agent/chat" initialMessages={toDisplay(rows)} />
    </div>
  );
}
