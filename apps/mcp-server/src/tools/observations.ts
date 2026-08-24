import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, gte, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { defineTool } from "../define-tool.js";

const PROPOSED_CHANGE_SCHEMA = z.object({
  target: z.enum(["student_levels", "student_interests", "goals"]),
  key: z.string().optional(),
  from: z.union([z.string(), z.number()]).optional(),
  to: z.union([z.string(), z.number()]).optional(),
});

export function registerObservationTools(server: McpServer): void {
  defineTool(server, {
    name: "get_recent_observations",
    description:
      "Observations about one student: teacher-approved ones, plus the AI's own still-pending ones " +
      "(so you can avoid filing duplicates). Rejected observations are excluded.",
    inputSchema: {
      student_id: z.string().uuid(),
      since: z.string().date().optional(),
      limit: z.number().int().min(1).max(100).default(30),
    },
    consent: ["development_tracking"],
    handler: async (input, { db }) => {
      const filters: SQL[] = [
        eq(s.observations.studentId, input.student_id),
        or(
          inArray(s.observations.status, ["approved", "partially_approved", "monitoring"]),
          and(eq(s.observations.status, "unverified"), eq(s.observations.sourceRole, "ai")),
        )!,
      ];
      if (input.since) filters.push(gte(s.observations.createdAt, input.since));

      const rows = await db
        .select({
          observation_id: s.observations.id,
          category: s.observations.category,
          statement: s.observations.statement,
          evidence_source: s.observations.evidenceSource,
          confidence: s.observations.confidence,
          source_role: s.observations.sourceRole,
          proposed_change: s.observations.proposedChange,
          status: s.observations.status,
          created_at: s.observations.createdAt,
        })
        .from(s.observations)
        .where(and(...filters))
        .orderBy(desc(s.observations.createdAt))
        .limit(input.limit);

      return { observations: rows };
    },
  });

  defineTool(server, {
    name: "save_observation",
    description:
      "File an observation about a student, optionally with a proposed profile change (e.g. a level move). " +
      "It is stored as unverified and goes to the teacher review queue — the proposed change is stored, NOT applied. " +
      "Record observable behaviour and academic evidence only; never psychological, medical or trauma inference.",
    inputSchema: {
      student_id: z.string().uuid(),
      category: z.string().min(2).max(80),
      statement: z.string().min(5),
      evidence_source: z.enum(s.evidenceSourceInCore.enumValues),
      evidence_ref: z.string().uuid().optional(),
      confidence: z.number().min(0).max(1),
      proposed_change: PROPOSED_CHANGE_SCHEMA.optional(),
      model_version: z.string().optional(),
    },
    consent: ["development_tracking"],
    handler: async (input, { db }) => {
      const [row] = await db
        .insert(s.observations)
        .values({
          studentId: input.student_id,
          category: input.category,
          statement: input.statement,
          evidenceSource: input.evidence_source,
          evidenceRef: input.evidence_ref ?? null,
          confidence: String(input.confidence),
          sourceRole: "ai",
          proposedChange: input.proposed_change ?? null,
          status: "unverified",
          modelVersion: input.model_version ?? null,
        })
        .returning({ id: s.observations.id });

      return {
        observation_id: row!.id,
        status: "unverified",
        note: "Queued for teacher review. The live profile is untouched until a teacher approves.",
      };
    },
  });
}
