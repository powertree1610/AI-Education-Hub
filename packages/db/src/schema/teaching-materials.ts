import {
  boolean,
  date,
  index,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { core, scanVerdictInCore, studentsInCore, subjectsInCore, usersInCore } from "./schema.js";

// Teacher-assigned materials + 1:1 OCR cache (migrations/0009 — v6).
// A material is teacher-authored content FOR the child (worksheet, reading),
// not child personal data. Lifecycle is isActive (deactivate, never delete).
// Deliberately NO ai_agent grants — material text reaches the tutor through
// the web app (app_user), same posture as work_sample_texts.

export const teachingMaterialsInCore = core.table(
  "teaching_materials",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentsInCore.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").references(() => subjectsInCore.id),
    title: varchar({ length: 300 }).notNull(),
    instructions: text(),
    fileUrl: text("file_url"),
    fileType: varchar("file_type", { length: 50 }),
    scanStatus: scanVerdictInCore("scan_status").default("pending").notNull(),
    dueDate: date("due_date"),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersInCore.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_teaching_materials_student").using(
      "btree",
      table.studentId.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
  ],
);

export const teachingMaterialTextsInCore = core.table("teaching_material_texts", {
  materialId: uuid("material_id")
    .primaryKey()
    .notNull()
    .references(() => teachingMaterialsInCore.id, { onDelete: "cascade" }),
  extractedText: text("extracted_text").notNull(),
  extractionModel: varchar("extraction_model", { length: 128 }).notNull(),
  pageCount: smallint("page_count"),
  truncated: boolean().default(false).notNull(),
  extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
