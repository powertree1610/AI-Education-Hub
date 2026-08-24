import "server-only";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent } from "@platform/shared";
import type { AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  chatCompletionStream,
  type ChatMessage,
  type OpenAiTool,
  type ToolCall,
  type UsageInfo,
} from "./central-api";
import { callLocalTool, isLocalTool } from "./local-tools";
import { callMcpTool } from "./mcp-client";

/**
 * The agent loop — OpenAI function-calling over the Central AI API Server,
 * ported from the proven ERP orchestrator (streaming, tool-call accumulation,
 * DeepSeek DSML/reasoning_content guards).
 */

export interface AgentTurnEvents {
  onDelta: (text: string) => void;
  onToolStart: (name: string) => void;
  onToolEnd: (name: string, isError: boolean) => void;
}

export interface AgentTurnResult {
  finalContent: string;
  /** Messages produced this turn (assistant + tool), for persistence/replay. */
  newMessages: ChatMessage[];
  usage: UsageInfo;
  /** Model requests made this turn (loop iterations). */
  apiCalls: number;
  /** Tool executions this turn (MCP + local). */
  toolsUsed: number;
}

/** DeepSeek occasionally emits hallucinated DSML tool markup — strip it. */
function cleanDeepSeekMarkup(content: string): string {
  return content
    .replace(/<｜DSML｜[\s\S]*$/g, "")
    .replace(/<\|DSML\|[\s\S]*$/g, "")
    .trim();
}

/** Which student is this tool call about? (For the teacher access guard.) */
async function resolveTargetStudent(args: Record<string, unknown>): Promise<string | null> {
  if (typeof args.student_id === "string") return args.student_id;
  if (typeof args.work_sample_id === "string") {
    const rows = await getDb()
      .select({ studentId: s.workSamples.studentId })
      .from(s.workSamples)
      .where(eq(s.workSamples.id, args.work_sample_id))
      .limit(1);
    return rows[0]?.studentId ?? null;
  }
  return null;
}

export async function runAgentTurn(opts: {
  model: string;
  systemPrompt: string;
  history: ChatMessage[];
  tools: OpenAiTool[];
  user: AppUser;
  /** Kiosk: every MCP call is pinned to this student, whatever the model says. */
  pinnedStudentId?: string;
  /** Surface-specific local tools (e.g. the kiosk's log_activity). */
  customTools?: {
    has(name: string): boolean;
    call(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }>;
  };
  maxIterations?: number;
  events: AgentTurnEvents;
}): Promise<AgentTurnResult> {
  const maxIterations = opts.maxIterations ?? 8;
  const currentMessages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt },
    ...opts.history,
  ];
  const newMessages: ChatMessage[] = [];
  const totalUsage: UsageInfo = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let finalContent = "";
  let apiCalls = 0;
  let toolsUsed = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    apiCalls++;
    let assistantContent = "";
    const toolCallAccum = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason = "";

    const stream = chatCompletionStream({
      model: opts.model,
      messages: currentMessages,
      tools: opts.tools.length ? opts.tools : undefined,
    });

    for await (const event of stream) {
      if (event.type === "delta") {
        assistantContent += event.content;
        opts.events.onDelta(event.content);
      } else if (event.type === "tool_call_delta") {
        const existing = toolCallAccum.get(event.index);
        if (!existing) {
          toolCallAccum.set(event.index, {
            id: event.id || "",
            name: event.name || "",
            arguments: event.arguments,
          });
        } else {
          if (event.id) existing.id = event.id;
          if (event.name) existing.name = event.name;
          existing.arguments += event.arguments;
        }
      } else if (event.type === "done") {
        finishReason = event.finish_reason || finishReason;
        if (event.usage) {
          totalUsage.prompt_tokens! += event.usage.prompt_tokens || 0;
          totalUsage.completion_tokens! += event.usage.completion_tokens || 0;
          totalUsage.total_tokens! += event.usage.total_tokens || 0;
        }
      }
    }

    const assistantToolCalls: ToolCall[] = [...toolCallAccum.values()].map((tc) => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments },
    }));

    if (assistantToolCalls.length === 0) {
      finalContent = cleanDeepSeekMarkup(assistantContent);
      newMessages.push({ role: "assistant", content: finalContent });
      break;
    }

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: assistantContent || null,
      tool_calls: assistantToolCalls,
    };
    currentMessages.push(assistantMsg);
    newMessages.push(assistantMsg);

    for (const toolCall of assistantToolCalls) {
      toolsUsed++;
      const name = toolCall.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      opts.events.onToolStart(name);
      let result: { text: string; isError: boolean };
      try {
        if (opts.pinnedStudentId && "student_id" in args) {
          // The kiosk model never chooses the student.
          args.student_id = opts.pinnedStudentId;
        }

        if (opts.customTools?.has(name)) {
          result = await opts.customTools.call(name, args);
        } else if (isLocalTool(name)) {
          result = await callLocalTool(name, args, opts.user);
        } else {
          // Teacher access guard: the MCP server runs as the service principal
          // and cannot know which staff member is asking — re-validate here.
          if (opts.user.role === "teacher") {
            const targetStudent = await resolveTargetStudent(args);
            if (targetStudent) {
              const allowed = await canUserAccessStudent(getDb(), {
                userId: opts.user.id,
                role: "teacher",
                studentId: targetStudent,
              });
              if (!allowed) {
                result = {
                  text: JSON.stringify({
                    error: "ACCESS_DENIED",
                    message: "This staff member is not assigned to that student.",
                  }),
                  isError: true,
                };
                currentMessages.push({ role: "tool", content: result.text, tool_call_id: toolCall.id });
                newMessages.push({ role: "tool", content: result.text, tool_call_id: toolCall.id });
                opts.events.onToolEnd(name, true);
                continue;
              }
            }
          }
          result = await callMcpTool(name, args);
        }
      } catch (err) {
        result = {
          text: JSON.stringify({ error: "TOOL_FAILED", message: (err as Error).message }),
          isError: true,
        };
      }

      const toolMsg: ChatMessage = {
        role: "tool",
        content: result.text,
        tool_call_id: toolCall.id,
      };
      currentMessages.push(toolMsg);
      newMessages.push(toolMsg);
      opts.events.onToolEnd(name, result.isError);
    }
  }

  if (!finalContent && newMessages.length > 0) {
    finalContent =
      "I ran out of steps while working on this — here is where I got to. Ask me to continue if needed.";
    newMessages.push({ role: "assistant", content: finalContent });
    opts.events.onDelta(finalContent);
  }

  return { finalContent, newMessages, usage: totalUsage, apiCalls, toolsUsed };
}
