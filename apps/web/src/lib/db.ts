import { createDb, type Db } from "@platform/db";
import { requireEnv } from "./env";

// Cache across Next.js dev hot reloads; one pool per process in prod.
const globalForDb = globalThis as unknown as { __appDb?: { db: Db; pool: unknown } };

/** The web app's DB handle — ALWAYS the app_user role, never owner/ai_agent. */
export function getDb(): Db {
  if (!globalForDb.__appDb) {
    globalForDb.__appDb = createDb({ connectionString: requireEnv("DATABASE_URL_APP") });
  }
  return globalForDb.__appDb.db;
}
