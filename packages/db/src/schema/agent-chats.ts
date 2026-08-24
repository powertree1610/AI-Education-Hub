import { index, integer, jsonb, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { core, studentsInCore, usersInCore } from "./schema.js";

// Staff-facing agent chat history — the two tables v1 ADDS to the approved
// schema (migrations/0001_agent_chats.sql; apply only after PM sign-off).
// Deliberately app_user-only: the AI never reads staff chat history via MCP.

export const agentChatsInCore = core.table(
  "agent_chats",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersInCore.id),
    studentId: uuid("student_id").references(() => studentsInCore.id),
    title: varchar({ length: 200 }),
    status: varchar({ length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_agent_chats_user").on(table.userId, table.updatedAt.desc())],
);

export const agentChatMessagesInCore = core.table(
  "agent_chat_messages",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => agentChatsInCore.id, { onDelete: "cascade" }),
    role: varchar({ length: 20 }).notNull(),
    // Raw OpenAI-format message JSON (incl. tool_calls / tool results) so tool
    // provenance survives reload exactly as sent.
    content: jsonb().notNull(),
    modelVersion: varchar("model_version", { length: 80 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_agent_chat_msgs_chat").on(table.chatId, table.createdAt)],
);
