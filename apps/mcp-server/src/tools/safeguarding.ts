import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { STUDENT_REF, defineTool } from "../define-tool.js";

/**
 * Tool #11 — the one write the agent may make into the restricted schema,
 * via the SECURITY DEFINER function only (ai_agent has EXECUTE, no table
 * grants). Deliberately NOT consent-gated: child protection overrides
 * consent (design §9).
 */
export function registerSafeguardingTools(server: McpServer): void {
  defineTool(server, {
    name: "flag_safeguarding_concern",
    description:
      "Raise a safeguarding concern about a student's welfare (possible abuse, neglect, self-harm risk, " +
      "or a disclosure the student made). Insert-only: the case goes to the safeguarding lead and you can " +
      "never read it back. Use ONLY for genuine welfare concerns — never for academic or behaviour issues.",
    inputSchema: {
      student_id: STUDENT_REF,
      reason: z
        .string()
        .min(10)
        .max(2000)
        .describe("Factual description of the concern, quoting what was said or seen — no diagnosis"),
      confidence: z.number().min(0).max(1),
    },
    consent: [],
    handler: async (input, { db, studentId }) => {
      await db.execute(
        sql`select core.flag_safeguarding_concern(${studentId}::uuid, ${input.reason}, ${input.confidence}, null)`,
      );
      return { flagged: true, note: "Safeguarding lead notified. This record is write-only for you." };
    },
  });
}
