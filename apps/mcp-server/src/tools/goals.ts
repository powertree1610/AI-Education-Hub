import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { defineTool } from "../define-tool.js";
import { subjectIdByCode } from "./util.js";

export function registerGoalTools(server: McpServer): void {
  defineTool(server, {
    name: "get_goals",
    description: "A student's goals (academic and personal) with status and dates.",
    inputSchema: {
      student_id: z.string().uuid(),
      status: z.enum(s.goalStatusInCore.enumValues).optional(),
    },
    consent: ["development_tracking"],
    handler: async (input, { db }) => {
      const filters: SQL[] = [eq(s.goals.studentId, input.student_id)];
      if (input.status) filters.push(eq(s.goals.status, input.status));

      const rows = await db
        .select({
          goal_id: s.goals.id,
          goal_type: s.goals.goalType,
          title: s.goals.title,
          description: s.goals.description,
          requested_by_role: s.goals.requestedByRole,
          status: s.goals.status,
          start_date: s.goals.startDate,
          target_date: s.goals.targetDate,
          review_date: s.goals.reviewDate,
        })
        .from(s.goals)
        .where(and(...filters))
        .orderBy(desc(s.goals.startDate));

      return { goals: rows };
    },
  });

  defineTool(server, {
    name: "suggest_goal",
    description:
      "Suggest a new goal for a student. It is stored as 'proposed' — a teacher must activate it before " +
      "it becomes part of the student's active goals.",
    inputSchema: {
      student_id: z.string().uuid(),
      goal_type: z.enum(s.goalTypeInCore.enumValues),
      title: z.string().min(3).max(200),
      description: z.string().optional(),
      subject_code: z.string().optional(),
    },
    consent: ["development_tracking"],
    handler: async (input, { db }) => {
      const subjectId = input.subject_code ? await subjectIdByCode(db, input.subject_code) : null;
      const [row] = await db
        .insert(s.goals)
        .values({
          studentId: input.student_id,
          goalType: input.goal_type,
          subjectId,
          title: input.title,
          description: input.description ?? null,
          requestedByRole: "ai",
          status: "proposed",
        })
        .returning({ id: s.goals.id });

      return {
        goal_id: row!.id,
        status: "proposed",
        note: "Proposed for teacher activation — not active yet.",
      };
    },
  });
}
