import { boolean, smallint, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { core, workSamplesInCore } from "./schema.js";

// Persisted OCR extraction per work sample (migrations/0007 — v5). 1:1 with
// work_samples; deliberately NO ai_agent grants — the cached text is served
// only through the web app's consent-gated read tool.

export const workSampleTextsInCore = core.table("work_sample_texts", {
  workSampleId: uuid("work_sample_id")
    .primaryKey()
    .notNull()
    .references(() => workSamplesInCore.id, { onDelete: "cascade" }),
  extractedText: text("extracted_text").notNull(),
  extractionModel: varchar("extraction_model", { length: 128 }).notNull(),
  pageCount: smallint("page_count"),
  truncated: boolean().default(false).notNull(),
  extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
