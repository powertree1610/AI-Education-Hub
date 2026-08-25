import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, decideSafetyAction } from "@platform/shared";
import { runAgentTurn } from "@/lib/ai/agent-loop";
import { classifyContent, deflectionMessage, recordSafetyEvent } from "@/lib/ai/safety";
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

/** Read-only MCP subset the kiosk agent may use — no write tools, no
 *  results/observations — plus the insert-only safeguarding flag (disclosure
 *  happens at the kiosk more than anywhere else). */
const KIOSK_MCP_TOOLS = new Set([
  "get_student_learning_profile",
  "get_goals",
  "get_session_history",
  "flag_safeguarding_concern",
]);

function sseEncode(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

/** A complete, immediately-closed SSE response (used for safety deflections). */
function sseOnce(events: Record<string, unknown>[]): Response {
  return new Response(events.map(sseEncode).join(""), { headers: SSE_HEADERS });
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

  // Safety gate (M9): classify the child's message BEFORE the agent sees it.
  // Blocked/redirected text lives only in safety_events.excerpt — the agent
  // context and the transcript get a withheld marker instead.
  const trimmed = message.trim();
  const inputVerdict = await classifyContent({
    surface: "chat_input",
    text: trimmed,
    studentAge: age,
    studentId: session.studentId,
    sessionId,
  });
  if (!inputVerdict.safe) {
    const decision = decideSafetyAction(inputVerdict.category, inputVerdict.severity);
    await recordSafetyEvent({
      studentId: session.studentId,
      sessionId,
      surface: "chat_input",
      verdict: inputVerdict,
      decision,
      classifierModel: model,
      text: trimmed,
    });
    if (decision.action !== "allowed") {
      const deflection = deflectionMessage(student.preferredAiLanguage);
      const gatedHistory = kioskHistory(sessionId);
      gatedHistory.push({ role: "user", content: "[message withheld by safety filter]" });
      gatedHistory.push({ role: "assistant", content: deflection });
      return sseOnce([{ type: "delta", text: deflection }, { type: "done" }]);
    }
  }

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
  const userMessage: ChatMessage = { role: "user", content: trimmed };
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

        // Output check runs after `done` (the child is never kept waiting):
        // flagged replies are recorded — and escalated if warranted — but a
        // reply that already streamed is not retracted.
        const outText = result.newMessages
          .filter((m) => m.role === "assistant" && typeof m.content === "string")
          .map((m) => m.content as string)
          .join("\n")
          .trim();
        if (outText) {
          const outVerdict = await classifyContent({
            surface: "chat_output",
            text: outText,
            studentAge: age,
            studentId: session.studentId,
            sessionId,
          });
          if (!outVerdict.safe) {
            await recordSafetyEvent({
              studentId: session.studentId,
              sessionId,
              surface: "chat_output",
              verdict: outVerdict,
              decision: decideSafetyAction(outVerdict.category, outVerdict.severity),
              classifierModel: model,
              text: outText,
            });
          }
        }
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
