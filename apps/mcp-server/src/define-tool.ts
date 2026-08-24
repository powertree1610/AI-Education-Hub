import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "@platform/db";
import {
  checkConsent,
  getCurrentConsents,
  writeAudit,
  type ConsentStatus,
  type ConsentType,
} from "@platform/shared";
import { getDb } from "./lib/db.js";

export interface ToolContext {
  db: Db;
  studentId: string;
  /** Current consent state — for conditional fields (e.g. transcripts). */
  consents: Map<ConsentType, ConsentStatus>;
}

export interface ToolDefinition<S extends z.ZodRawShape> {
  name: string;
  description: string;
  inputSchema: S;
  /** Every listed type must be 'granted' or the call is refused. */
  consent: readonly ConsentType[];
  /**
   * Resolve the student this call is about. Defaults to input.student_id.
   * Tools keyed by another id (work_sample_id, session_id) look it up here.
   */
  resolveStudentId?: (input: z.infer<z.ZodObject<S>>, db: Db) => Promise<string | null>;
  handler: (input: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
}

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * The single choke point every tool goes through (design §9):
 * (1) scoped to one student_id, (2) consent-checked, (3) audit-logged.
 * Consent is opt-in by construction: a missing consents row is a refusal.
 */
export function defineTool<S extends z.ZodRawShape>(server: McpServer, def: ToolDefinition<S>): void {
  // The SDK's generic ToolCallback<S> does not unify cleanly with our wrapper's
  // return shape under an unresolved S; the cast below is contained to the
  // registration call — tool handlers themselves stay fully typed.
  const callback = async (parsedInput: unknown) => {
    {
      const db = getDb();
      const input = z.object(def.inputSchema).parse(parsedInput) as z.infer<z.ZodObject<S>>;

      const studentId = def.resolveStudentId
        ? await def.resolveStudentId(input, db)
        : ((input as Record<string, unknown>)["student_id"] as string | undefined) ?? null;

      if (!studentId) {
        return textResult({ code: "NOT_FOUND", message: "Student not found for this input" }, true);
      }

      const { granted, missing } = await checkConsent(db, studentId, def.consent);
      if (!granted) {
        await writeAudit(db, {
          actorType: "ai_agent",
          action: `tool_denied:${def.name}`,
          entityType: "student",
          entityId: studentId,
          details: { missing },
        });
        return textResult(
          {
            code: "CONSENT_NOT_GRANTED",
            message: `Cannot ${def.name} for this student: required consent not granted`,
            missing,
          },
          true,
        );
      }

      try {
        const consents = await getCurrentConsents(db, studentId);
        const result = await def.handler(input, { db, studentId, consents });
        await writeAudit(db, {
          actorType: "ai_agent",
          action: `tool:${def.name}`,
          entityType: "student",
          entityId: studentId,
        });
        return textResult(result);
      } catch (err) {
        await writeAudit(db, {
          actorType: "ai_agent",
          action: `tool_error:${def.name}`,
          entityType: "student",
          entityId: studentId,
          details: { error: (err as Error).message.slice(0, 300) },
        });
        return textResult({ code: "TOOL_ERROR", message: (err as Error).message }, true);
      }
    }
  };

  server.registerTool(
    def.name,
    {
      description: def.description,
      inputSchema: def.inputSchema,
    },
    callback as unknown as ToolCallback<S>,
  );
}
