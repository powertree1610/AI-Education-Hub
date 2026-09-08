import "server-only";
import { and, eq } from "drizzle-orm";
import { NextRequest, after } from "next/server";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, decideSafetyAction } from "@platform/shared";
import { runAgentTurn } from "@/lib/ai/agent-loop";
import { classifyContent, deflectionMessage, recordSafetyEvent } from "@/lib/ai/safety";
import type { ChatMessage, OpenAiTool } from "@/lib/ai/central-api";
import { KIOSK_LOCAL_TOOLS, callKioskLocalTool, isKioskLocalTool } from "@/lib/ai/kiosk-tools";
import { resolveChatModel } from "@/lib/ai/license";
import { listMcpToolsAsOpenAi } from "@/lib/ai/mcp-client";
import { dailyCompanionPrompt, guidedLearningPrompt } from "@/lib/ai/prompts";
import { SSE_HEADERS, sseEncode, sseOnce } from "@/lib/ai/sse";
import { logUsage } from "@/lib/ai/usage-log";
import { currentAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { kioskHistory } from "@/lib/kiosk-state";
import { finalizeSession } from "@/lib/session-lifecycle";
import { studentForUser } from "@/lib/student";

/**
 * Shared child-facing chat handler behind BOTH surfaces:
 *  - "kiosk":  School Mode — teacher-started session, teacher's login.
 *  - "student": Home Mode — the student's own account and session.
 * The safety layer (input gate, post-stream output check, covert tools,
 * escalation) is identical for both by construction.
 */

/** MCP subset per session kind. Academic = the read tools + safeguarding;
 *  Daily = a companion chat that needs NO academic data at all. */
const ACADEMIC_MCP_TOOLS = new Set([
  "get_student_learning_profile",
  "get_goals",
  "get_session_history",
  "flag_safeguarding_concern",
]);
const DAILY_MCP_TOOLS = new Set(["flag_safeguarding_concern"]);

/** Tools the child must never see happening — their tool_start/tool_end
 *  events are suppressed server-side so nothing reaches the UI. */
const COVERT_TOOLS = new Set(["flag_safeguarding_concern"]);

/** Child input cap — classification always covers the full text. */
const MESSAGE_MAX_CHARS = 2000;

/** Allowed-hours are interpreted in the centre's timezone (PM decision). */
const CENTRE_TIMEZONE = "Asia/Kuala_Lumpur";

function centreTimeHHMMSS(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CENTRE_TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

export async function handleSessionChat(
  req: NextRequest,
  surface: "kiosk" | "student",
): Promise<Response> {
  const user = await currentAppUser();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (surface === "kiosk" && user.role !== "teacher" && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (surface === "student" && user.role !== "student") {
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

  // Authorization per surface.
  if (surface === "kiosk" && user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId: session.studentId,
    });
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (surface === "student") {
    const ownStudent = await studentForUser(user.id);
    if (!ownStudent || session.startedBy !== user.id || session.studentId !== ownStudent.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const student = (
    await db.select().from(s.students).where(eq(s.students.id, session.studentId)).limit(1)
  )[0];
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  // Home Mode time enforcement (lazy, per message): expired sessions are
  // finalized here and the child gets a friendly wrap-up instead of a turn.
  if (surface === "student") {
    const minutes = student.maxSessionMinutes ?? 45;
    const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
    const pastLimit = elapsedMs > minutes * 60_000;
    const nowHHMMSS = centreTimeHHMMSS();
    const outsideHours =
      student.allowedHoursStart && student.allowedHoursEnd
        ? nowHHMMSS < student.allowedHoursStart || nowHHMMSS > student.allowedHoursEnd
        : false;
    if (pastLimit || outsideHours) {
      await finalizeSession({
        session: { id: session.id, studentId: session.studentId },
        endedReason: pastLimit ? "time_limit" : "outside_hours",
        actor: { type: "system" },
      });
      const bye = pastLimit
        ? "Time's up for today — great job! See you next time. 👋"
        : "It's outside your chat hours right now — see you tomorrow! 👋";
      return sseOnce([
        { type: "delta", text: bye },
        { type: "done" },
        { type: "session_ended" },
      ]);
    }
  }

  const age = Math.floor(
    (Date.now() - new Date(student.dob).getTime()) / (365.25 * 24 * 3600 * 1000),
  );

  // Resolved once per turn: chat model, classifier record, both classify calls.
  const model = await resolveChatModel("kiosk");

  // MCP tool list is independent of the safety verdict — fetch concurrently.
  // Early-return paths must not leave an unhandled rejection.
  const mcpToolsPromise = listMcpToolsAsOpenAi();
  mcpToolsPromise.catch(() => {});

  // Safety gate (M9): classify the child's message BEFORE the agent sees it.
  const trimmed = message.trim().slice(0, MESSAGE_MAX_CHARS);
  const inputVerdict = await classifyContent({
    surface: "chat_input",
    text: trimmed,
    studentAge: age,
    studentId: session.studentId,
    sessionId,
    model,
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
      const deflection = deflectionMessage(student.preferredAiLanguage, session.supervisionMode);
      const gatedHistory = kioskHistory(sessionId);
      gatedHistory.push({ role: "user", content: "[message withheld by safety filter]" });
      gatedHistory.push({ role: "assistant", content: deflection });
      return sseOnce([{ type: "delta", text: deflection }, { type: "done" }]);
    }
  }

  const allowedMcp = session.sessionKind === "daily" ? DAILY_MCP_TOOLS : ACADEMIC_MCP_TOOLS;
  let mcpTools: OpenAiTool[];
  try {
    mcpTools = (await mcpToolsPromise).filter((t) => allowedMcp.has(t.function.name));
  } catch (err) {
    return Response.json(
      { error: `MCP server unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }
  const tools = [...mcpTools, ...KIOSK_LOCAL_TOOLS];

  const promptArgs = {
    preferredName: student.preferredName ?? student.fullName,
    age,
    schoolGrade: student.schoolGrade,
    preferredAiLanguage: student.preferredAiLanguage,
    aiAccessLevel: student.aiAccessLevel,
    supervisionMode: session.supervisionMode,
  };
  const systemPrompt =
    session.sessionKind === "daily"
      ? dailyCompanionPrompt(promptArgs)
      : guidedLearningPrompt({ ...promptArgs, assistMode: session.assistMode });

  const history = kioskHistory(sessionId);
  const userMessage: ChatMessage = { role: "user", content: trimmed };
  history.push(userMessage);

  // Output check must not hold the SSE stream open (the client re-enables
  // input only when the stream closes) — it runs in after(), fed by a
  // deferred the stream resolves once the reply has finished.
  let resolveOutputText!: (text: string | null) => void;
  const outputText = new Promise<string | null>((resolve) => {
    resolveOutputText = resolve;
  });
  after(async () => {
    const text = await outputText;
    if (!text) return;
    const outVerdict = await classifyContent({
      surface: "chat_output",
      text,
      studentAge: age,
      studentId: session.studentId,
      sessionId,
      model,
    });
    if (!outVerdict.safe) {
      // Recorded, never retracted — the reply already streamed.
      await recordSafetyEvent({
        studentId: session.studentId,
        sessionId,
        surface: "chat_output",
        verdict: outVerdict,
        decision: decideSafetyAction(outVerdict.category, outVerdict.severity),
        classifierModel: model,
        text,
      });
    }
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sseEncode(payload)));
      try {
        const result = await runAgentTurn({
          model,
          systemPrompt,
          history: [...history],
          tools,
          user,
          pinnedStudentId: session.studentId,
          pinnedSessionRef: sessionId,
          customTools: {
            has: isKioskLocalTool,
            call: (name, args) => callKioskLocalTool(name, args, sessionId),
          },
          events: {
            onDelta: (text) => emit({ type: "delta", text }),
            // Covert tools must leave no visible trace on the child's screen.
            onToolStart: (name) => {
              if (!COVERT_TOOLS.has(name)) emit({ type: "tool_start", name });
            },
            onToolEnd: (name, isError) => {
              if (!COVERT_TOOLS.has(name)) emit({ type: "tool_end", name, isError });
            },
          },
        });

        // Keep the running in-memory context (persisted only at session end,
        // and only with conversation_storage consent).
        history.push(...result.newMessages);

        // One aggregated usage row per turn.
        await logUsage(model, result.usage, {
          feature: surface === "kiosk" ? "kiosk_chat" : "student_chat",
          userId: user.id,
          studentId: session.studentId,
          refId: sessionId,
        });

        emit({ type: "done" });
        resolveOutputText(
          result.newMessages
            .filter((m) => m.role === "assistant" && typeof m.content === "string")
            .map((m) => m.content as string)
            .join("\n")
            .trim() || null,
        );
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        resolveOutputText(null); // no-op if already resolved
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
