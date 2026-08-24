import { boolean, index, integer, numeric, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { core, studentsInCore, usersInCore } from "./schema.js";

// LLM token usage tracking (migrations/0002_ai_usage_logs.sql) — the ERP
// UsageLogs design adapted to this platform. Written by apps/web only.
export const aiUsageLogsInCore = core.table(
  "ai_usage_logs",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").references(() => usersInCore.id),
    studentId: uuid("student_id").references(() => studentsInCore.id),
    usageType: varchar("usage_type", { length: 50 }).notNull(),
    refId: uuid("ref_id"),
    model: varchar({ length: 128 }).default("").notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }).default("0").notNull(),
    isEstimated: boolean("is_estimated").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_ai_usage_logs_user").on(table.userId, table.createdAt),
    index("idx_ai_usage_logs_student").on(table.studentId, table.createdAt),
    index("idx_ai_usage_logs_created").on(table.createdAt.desc()),
  ],
);
