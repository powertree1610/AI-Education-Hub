import { createDb, type Db } from "@platform/db";
import { requireEnv } from "./env.js";

let cached: { db: Db } | null = null;

/** The MCP server's DB handle — ALWAYS the ai_agent role. The role's grants
 *  are the real security boundary; this code is defense-in-depth. */
export function getDb(): Db {
  if (!cached) {
    cached = createDb({ connectionString: requireEnv("DATABASE_URL_AI") });
  }
  return cached.db;
}
