import "server-only";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { getDb } from "@/lib/db";
import type { OpenAiTool } from "./central-api";

/** Kiosk-side local tool: the agent logs completed learning activities.
 *  session_activities rows are written by the web app (app_user). */

export const KIOSK_LOCAL_TOOLS: OpenAiTool[] = [
  {
    type: "function",
    function: {
      name: "log_activity",
      description:
        "Log a completed learning activity for this session (call after finishing a quiz, tutoring " +
        "block or revision exercise — not for small talk). Counts are for this activity only.",
      parameters: {
        type: "object",
        properties: {
          activity_type: {
            type: "string",
            enum: ["tutoring", "homework", "quiz", "revision", "conversation", "game", "storytelling"],
          },
          subject_code: { type: "string", description: "e.g. ENG, MATH (omit if none)" },
          topic: { type: "string" },
          difficulty: { type: "string", description: "e.g. Standard 4" },
          attempted: { type: "integer" },
          correct: { type: "integer" },
          incorrect: { type: "integer" },
          hints_used: { type: "integer" },
          engagement_level: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["activity_type", "topic"],
        additionalProperties: false,
      },
    },
  },
];

export function isKioskLocalTool(name: string): boolean {
  return KIOSK_LOCAL_TOOLS.some((t) => t.function.name === name);
}

export async function callKioskLocalTool(
  name: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<{ text: string; isError: boolean }> {
  if (name !== "log_activity") {
    return { text: JSON.stringify({ error: `Unknown kiosk tool: ${name}` }), isError: true };
  }
  const db = getDb();

  let subjectId: string | null = null;
  if (typeof args.subject_code === "string" && args.subject_code) {
    const rows = await db
      .select({ id: s.subjects.id })
      .from(s.subjects)
      .where(eq(s.subjects.code, args.subject_code.toUpperCase()))
      .limit(1);
    subjectId = rows[0]?.id ?? null;
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

  const [row] = await db
    .insert(s.sessionActivities)
    .values({
      sessionId,
      activityType: String(args.activity_type) as (typeof s.activityTypeInCore.enumValues)[number],
      subjectId,
      topic: typeof args.topic === "string" ? args.topic.slice(0, 200) : null,
      difficulty: typeof args.difficulty === "string" ? args.difficulty.slice(0, 50) : null,
      attempted: num(args.attempted),
      correct: num(args.correct),
      incorrect: num(args.incorrect),
      hintsUsed: num(args.hints_used),
      engagementLevel: num(args.engagement_level),
    })
    .returning({ id: s.sessionActivities.id });

  return { text: JSON.stringify({ activity_id: row!.id, logged: true }), isError: false };
}
