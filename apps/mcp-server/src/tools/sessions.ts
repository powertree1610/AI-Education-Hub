import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { STUDENT_REF, defineTool } from "../define-tool.js";

export function registerSessionTools(server: McpServer): void {
  defineTool(server, {
    name: "get_session_history",
    description:
      "Past AI sessions for one student with per-activity stats (topic, attempted/correct, engagement). " +
      "Transcripts are included only when conversation-storage consent is granted.",
    inputSchema: {
      student_id: STUDENT_REF,
      limit: z.number().int().min(1).max(20).default(5),
    },
    consent: ["ai_interaction"],
    handler: async (input, { db, consents, studentId }) => {
      const sessions = await db
        .select({
          session_id: s.aiSessions.id,
          started_at: s.aiSessions.startedAt,
          ended_at: s.aiSessions.endedAt,
          status: s.aiSessions.status,
          supervision_mode: s.aiSessions.supervisionMode,
        })
        .from(s.aiSessions)
        .where(eq(s.aiSessions.studentId, studentId))
        .orderBy(desc(s.aiSessions.startedAt))
        .limit(input.limit);

      const sessionIds = sessions.map((x) => x.session_id);
      const activities = sessionIds.length
        ? await db
            .select({
              session_id: s.sessionActivities.sessionId,
              activity_type: s.sessionActivities.activityType,
              topic: s.sessionActivities.topic,
              difficulty: s.sessionActivities.difficulty,
              attempted: s.sessionActivities.attempted,
              correct: s.sessionActivities.correct,
              incorrect: s.sessionActivities.incorrect,
              hints_used: s.sessionActivities.hintsUsed,
              engagement_level: s.sessionActivities.engagementLevel,
            })
            .from(s.sessionActivities)
            .where(inArray(s.sessionActivities.sessionId, sessionIds))
        : [];

      const transcriptsAllowed = consents.get("conversation_storage") === "granted";
      const transcripts = transcriptsAllowed && sessionIds.length
        ? await db
            .select({
              session_id: s.sessionTranscripts.sessionId,
              messages: s.sessionTranscripts.messages,
            })
            .from(s.sessionTranscripts)
            .where(inArray(s.sessionTranscripts.sessionId, sessionIds))
        : [];

      return {
        sessions: sessions.map((session) => ({
          ...session,
          activities: activities.filter((a) => a.session_id === session.session_id),
          ...(transcriptsAllowed
            ? { transcript: transcripts.find((t) => t.session_id === session.session_id)?.messages ?? null }
            : {}),
        })),
        ...(transcriptsAllowed ? {} : { note: "Transcripts omitted: conversation_storage consent not granted" }),
      };
    },
  });
}
