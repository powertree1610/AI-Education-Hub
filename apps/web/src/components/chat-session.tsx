import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { ChatWindow, type DisplayMessage, type TurnUsage } from "@/components/chat-window";
import type { ChatMessage, ToolCall } from "@/lib/ai/central-api";
import { estimateCostParts } from "@/lib/ai/usage-log";
import type { AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface StoredRow {
  content: unknown;
  modelVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

function toDisplay(rows: StoredRow[]): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  let turnApiCalls = 0;
  let turnTools = 0;

  for (const row of rows) {
    const msg = row.content as ChatMessage;
    if (msg.role === "user" && typeof msg.content === "string") {
      turnApiCalls = 0;
      turnTools = 0;
      out.push({ role: "user", text: msg.content });
    } else if (msg.role === "assistant") {
      turnApiCalls++;
      for (const tc of msg.tool_calls ?? []) {
        turnTools++;
        out.push({ role: "tool_note", text: `⚙ ${(tc as ToolCall).function.name} ✓` });
      }
      if (typeof msg.content === "string" && msg.content.trim()) {
        out.push({ role: "assistant", text: msg.content });
      }
      // The final row of each turn carries the aggregated token counts.
      if (row.modelVersion && (row.inputTokens ?? 0) + (row.outputTokens ?? 0) > 0) {
        const promptTokens = row.inputTokens ?? 0;
        const completionTokens = row.outputTokens ?? 0;
        const cost = estimateCostParts(row.modelVersion, promptTokens, completionTokens);
        const usage: TurnUsage = {
          model: row.modelVersion,
          apiCalls: turnApiCalls,
          toolsUsed: turnTools,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          inputCost: cost.input,
          outputCost: cost.output,
          totalCost: cost.total,
        };
        out.push({ role: "usage", text: "", usage });
      }
    }
    // tool-result rows are internal replay state, not displayed
  }
  return out;
}

/** One chat with history — rendered inside both the admin and teacher shells. */
export async function ChatSession({ user, chatId }: { user: AppUser; chatId: string }) {
  const db = getDb();
  const chat = (
    await db.select().from(s.agentChats).where(eq(s.agentChats.id, chatId)).limit(1)
  )[0];
  if (!chat || chat.userId !== user.id) notFound();

  const rows = await db
    .select({
      content: s.agentChatMessages.content,
      modelVersion: s.agentChatMessages.modelVersion,
      inputTokens: s.agentChatMessages.inputTokens,
      outputTokens: s.agentChatMessages.outputTokens,
    })
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
