import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { schema as s } from "@platform/db";
import { canUserAccessStudent } from "@platform/shared";
import { runAgentTurn } from "@/lib/ai/agent-loop";
import type { ChatMessage, OpenAiTool } from "@/lib/ai/central-api";
import { KIOSK_LOCAL_TOOLS, callKioskLocalTool, isKioskLocalTool } from "@/lib/ai/kiosk-tools";
import { resolveChatModel } from "@/lib/ai/license";
import { listMcpToolsAsOpenAi } from "@/lib/ai/mcp-client";
import { kioskSystemPrompt } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage-log";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { kioskHistory } from "@/lib/kiosk-state";

export const dynamic = "force-dynamic";

/** Read-only MCP subset the kiosk agent may use — no write tools, no results/observations. */
const KIOSK_MCP_TOOLS = new Set(["get_student_learning_profile", "get_goals", "get_session_history"]);

function sseEncode(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  // The kiosk runs under the supervising teacher's login on the centre device.
  const user = await currentAppUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sessionId, message } = (await req.json()) as { sessionId?: string; message?: string };
  if (!sessionId || !message?.trim()) {
    return Response.json({ error: "sessionId and message are required" }, { status: 400 });
  }

  const db = getDb();
  const session = (
    await db
      .select()
      .from(s.aiSessions)
      .where(and(eq(s.aiSessions.id, sessionId), eq(s.aiSessions.status, "active")))
      .limit(1)
  )[0];
  if (!session) return Response.json({ error: "Active session not found" }, { status: 404 });

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId: session.studentId,
    });
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = (
    await db.select().from(s.students).where(eq(s.students.id, session.studentId)).limit(1)
  )[0];
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  const age = Math.floor(
    (Date.now() - new Date(student.dob).getTime()) / (365.25 * 24 * 3600 * 1000),
  );

  const model = await resolveChatModel("kiosk");
  let mcpTools: OpenAiTool[];
  try {
    mcpTools = (await listMcpToolsAsOpenAi()).filter((t) => KIOSK_MCP_TOOLS.has(t.function.name));
  } catch (err) {
    return Response.json(
      { error: `MCP server unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }
  const tools = [...mcpTools, ...KIOSK_LOCAL_TOOLS];

  const history = kioskHistory(sessionId);
  const userMessage: ChatMessage = { role: "user", content: message.trim() };
  history.push(userMessage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sseEncode(payload)));
      try {
        const result = await runAgentTurn({
          model,
          systemPrompt: kioskSystemPrompt({
            preferredName: student.preferredName ?? student.fullName,
            age,
            schoolGrade: student.schoolGrade,
            preferredAiLanguage: student.preferredAiLanguage,
            aiAccessLevel: student.aiAccessLevel,
          }),
          history: [...history],
          tools,
          user,
          pinnedStudentId: session.studentId,
          customTools: {
            has: isKioskLocalTool,
            call: (name, args) => callKioskLocalTool(name, args, sessionId),
          },
          events: {
            onDelta: (text) => emit({ type: "delta", text }),
            onToolStart: (name) => emit({ type: "tool_start", name }),
            onToolEnd: (name, isError) => emit({ type: "tool_end", name, isError }),
          },
        });

        // Keep the running in-memory context (persisted only at session end,
        // and only with conversation_storage consent).
        history.push(...result.newMessages);

        // One aggregated usage row per turn, attributed to the supervising
        // teacher AND the student the session is about.
        await logUsage(model, result.usage, {
          feature: "kiosk_chat",
          userId: user.id,
          studentId: session.studentId,
          refId: sessionId,
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
