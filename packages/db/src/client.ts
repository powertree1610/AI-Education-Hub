import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

export type Db = NodePgDatabase<typeof schema>;

export interface CreateDbOptions {
  connectionString: string;
  /** Max pool size. Keep small — Neon pooled endpoints multiplex. */
  max?: number;
}

/**
 * Create a Drizzle client over node-postgres.
 * Callers pick the role by connection string and must never mix them:
 *   apps/web           → DATABASE_URL_APP  (app_user)
 *   apps/mcp-server    → DATABASE_URL_AI   (ai_agent)
 *   packages/db/scripts → DATABASE_URL     (owner; migrations/seeds only)
 */
export function createDb(opts: CreateDbOptions): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: opts.connectionString,
    max: opts.max ?? 5,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
