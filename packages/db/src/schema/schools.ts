import { boolean, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { core } from "./schema.js";

// Schools master table (migrations/0005_schools.sql — v5). Replaces the
// free-text students.school_name; that column is kept as read-only legacy.

export const schoolsInCore = core.table("schools", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 200 }).notNull(),
  schoolType: varchar("school_type", { length: 100 }),
  curriculum: varchar({ length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
