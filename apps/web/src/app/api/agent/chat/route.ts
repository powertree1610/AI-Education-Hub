import { asc, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { schema as s } from "@platform/db";
import { runAgentTurn } from "@/lib/ai/agent-loop";
import { type ChatMessage } from "@/lib/ai/central-api";
import { resolveChatModel } from "@/lib/ai/license";
import { LOCAL_TOOLS } from "@/lib/ai/local-tools";
import { listMcpToolsAsOpenAi } from "@/lib/ai/mcp-client";
import { staffSystemPrompt } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage-log";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function sseEncode(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  const user = await currentAppUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { chatId, message } = (await req.json()) as { chatId?: string; message?: string };
  if (!chatId || !message?.trim()) {
    return Response.json({ error: "chatId and message are required" }, { status: 400 });
  }

  const db = getDb();
  const chat = (
    await db.select().from(s.agentChats).where(eq(s.agentChats.id, chatId)).limit(1)
  )[0];
  if (!chat || chat.userId !== user.id) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  const historyRows = await db
    .select({ content: s.agentChatMessages.content })
    .from(s.agentChatMessages)
    .where(eq(s.agentChatMessages.chatId, chatId))
    .orderBy(asc(s.agentChatMessages.createdAt));
  const history = historyRows.map((r) => r.content as unknown as ChatMessage);

  const userMessage: ChatMessage = { role: "user", content: message.trim() };
  await db.insert(s.agentChatMessages).values({
    chatId,
    role: "user",
    content: userMessage,
  });

  const model = await resolveChatModel("staff");
  let tools;
  try {
    tools = [...(await listMcpToolsAsOpenAi()), ...LOCAL_TOOLS];
  } catch (err) {
    return Response.json(
      { error: `MCP server unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sseEncode(payload)));
      try {
        const result = await runAgentTurn({
          model,
          systemPrompt: staffSystemPrompt({ userName: user.name, userRole: user.role }),
          history: [...history, userMessage],
          tools,
          user,
          events: {
            onDelta: (text) => emit({ type: "delta", text }),
            onToolStart: (name) => emit({ type: "tool_start", name }),
            onToolEnd: (name, isError) => emit({ type: "tool_end", name, isError }),
          },
        });

        // Persist the turn: every produced message, usage on the final row.
        for (const [i, msg] of result.newMessages.entries()) {
          const isLast = i === result.newMessages.length - 1;
          await db.insert(s.agentChatMessages).values({
            chatId,
            role: msg.role,
            content: msg,
            modelVersion: isLast ? model : null,
            inputTokens: isLast ? (result.usage.prompt_tokens ?? null) : null,
            outputTokens: isLast ? (result.usage.completion_tokens ?? null) : null,
          });
        }
        await db
          .update(s.agentChats)
          .set({
            updatedAt: sql`now()`,
            ...(chat.title ? {} : { title: message.trim().slice(0, 80) }),
          })
          .where(eq(s.agentChats.id, chatId));

        // One aggregated usage row per turn (chat model calls; OCR logs its own).
        await logUsage(model, result.usage, {
          feature: "staff_chat",
          userId: user.id,
          studentId: chat.studentId,
          refId: chatId,
        });

        emit({ type: "done" });
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
