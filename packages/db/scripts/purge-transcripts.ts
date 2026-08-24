/**
 * Transcript retention purge: deletes session_transcripts rows whose
 * expires_at has passed. Run as the DB OWNER role on a schedule
 * (Windows Task Scheduler):
 *   pnpm --filter @platform/db purge-transcripts
 */
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import * as s from "../src/schema/index.js";
import { requireEnv } from "./env.js";

const { db, pool } = createDb({ connectionString: requireEnv("DATABASE_URL") });

async function main() {
  const res = await db.execute(
    sql`delete from core.session_transcripts where expires_at is not null and expires_at < now()`,
  );
  const purged = res.rowCount ?? 0;
  console.log(`purged ${purged} expired transcript(s)`);

  if (purged > 0) {
    await db.insert(s.auditLogInCore).values({
      actorType: "system",
      action: "purged_transcripts",
      entityType: "session_transcript",
      details: { count: purged },
    });
  }
}

main()
  .catch((err) => {
    console.error("purge failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
