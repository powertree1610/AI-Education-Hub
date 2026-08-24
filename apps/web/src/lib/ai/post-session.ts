import "server-only";
import { randomUUID } from "node:crypto";
import { runAgentTurn } from "./agent-loop";
import type { ChatMessage } from "./central-api";
import { resolveChatModel } from "./license";
import { listMcpToolsAsOpenAi } from "./mcp-client";
import { postSessionPrompt, weeklySynthesisPrompt } from "./prompts";
import { logUsage } from "./usage-log";
import type { AppUser } from "@/lib/auth";

/**
 * The two AI producers of design §9's observation engine:
 *  - per-session pass, right after each kiosk session ends
 *  - weekly synthesis, one consolidated pass per active student
 * Both write ONLY through the consent-gated MCP tools (save_observation,
 * suggest_goal) — everything lands unverified in the teacher review queue.
 */

const OBSERVER_MCP_TOOLS = new Set([
  "get_student_learning_profile",
  "get_recent_observations",
  "get_session_history",
  "get_work_analyses",
  "save_observation",
  "suggest_goal",
]);

const SYSTEM_ACTOR: AppUser = {
  // Background jobs run with no staff identity; MCP-side consent gating and
  // the admin-equivalent scope are intentional (service principal).
  id: "system",
  role: "admin",
  name: "System",
  email: null,
};

async function observerTools() {
  return (await listMcpToolsAsOpenAi()).filter((t) => OBSERVER_MCP_TOOLS.has(t.function.name));
}

const silentEvents = {
  onDelta: () => {},
  onToolStart: () => {},
  onToolEnd: () => {},
};

export interface SessionEvidence {
  sessionId: string;
  studentId: string;
  activities: {
    activityType: string;
    topic: string | null;
    attempted: number | null;
    correct: number | null;
    hintsUsed: number | null;
    engagementLevel: number | null;
  }[];
  transcriptText: string | null;
}

/** Fire-and-forget per-session pass — call via next/server after(). */
export async function runPostSessionPass(evidence: SessionEvidence): Promise<void> {
  try {
    const model = await resolveChatModel("staff");
    const activityLines =
      evidence.activities
        .map(
          (a) =>
            `- ${a.activityType}${a.topic ? ` (${a.topic})` : ""}: attempted ${a.attempted ?? "?"}, correct ${a.correct ?? "?"}, hints ${a.hintsUsed ?? "?"}, engagement ${a.engagementLevel ?? "?"}/5`,
        )
        .join("\n") || "(no logged activities)";

    const userMessage: ChatMessage = {
      role: "user",
      content:
        `Session ${evidence.sessionId} for student ${evidence.studentId} just ended.\n\n` +
        `Activities:\n${activityLines}\n\n` +
        (evidence.transcriptText
          ? `Conversation:\n${evidence.transcriptText.slice(0, 8000)}`
          : `Conversation content not available.`),
    };

    const result = await runAgentTurn({
      model,
      systemPrompt: postSessionPrompt(),
      history: [userMessage],
      tools: await observerTools(),
      user: SYSTEM_ACTOR,
      pinnedStudentId: evidence.studentId,
      maxIterations: 6,
      events: silentEvents,
    });

    await logUsage(model, result.usage, {
      feature: "post_session",
      studentId: evidence.studentId,
      refId: evidence.sessionId,
    });
    console.log(`[post-session] ${evidence.sessionId}: ${result.finalContent.slice(0, 200)}`);
  } catch (err) {
    // Never let the observer break session teardown.
    console.error(`[post-session] failed for ${evidence.sessionId}:`, (err as Error).message);
  }
}

/** One weekly-synthesis pass for one student. Returns the model's summary line. */
export async function runWeeklySynthesisForStudent(
  studentId: string,
  batchId: string = randomUUID(),
): Promise<string> {
  const model = await resolveChatModel("staff");
  const result = await runAgentTurn({
    model,
    systemPrompt: weeklySynthesisPrompt(batchId),
    history: [
      {
        role: "user",
        content: `Run the weekly synthesis for student ${studentId} (batch ${batchId}).`,
      },
    ],
    tools: await observerTools(),
    user: SYSTEM_ACTOR,
    pinnedStudentId: studentId,
    maxIterations: 8,
    events: silentEvents,
  });

  await logUsage(model, result.usage, {
    feature: "weekly_synthesis",
    studentId,
    refId: batchId,
  });
  return result.finalContent;
}
