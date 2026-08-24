import { randomUUID } from "node:crypto";
import { gte, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { schema as s } from "@platform/db";
import { writeAudit } from "@platform/shared";
import { runWeeklySynthesisForStudent } from "@/lib/ai/post-session";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
// One synthesis per student can take a while; allow the route time to finish.
export const maxDuration = 600;

/**
 * Weekly synthesis job (design §9 "Scheduled"): for each student active this
 * week, file consolidated observation proposals into the teacher queue.
 *
 * Triggered by Windows Task Scheduler:
 *   curl -X POST -H "x-job-secret: %JOB_SECRET%" https://<host>/api/jobs/weekly-synthesis
 */
export async function POST(req: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (!secret || req.headers.get("x-job-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Students with a session OR a fresh work analysis this week.
  const rows = await db.execute(sql`
    select distinct student_id from (
      select student_id from core.ai_sessions where started_at >= ${since}
      union
      select w.student_id from core.work_analyses a
        join core.work_samples w on w.id = a.work_sample_id
       where a.analyzed_at >= ${since}
    ) active
  `);
  const studentIds = (rows.rows as { student_id: string }[]).map((r) => r.student_id);

  const batchId = randomUUID();
  const results: { studentId: string; summary: string }[] = [];
  for (const studentId of studentIds) {
    try {
      const summary = await runWeeklySynthesisForStudent(studentId, batchId);
      results.push({ studentId, summary: summary.slice(0, 300) });
    } catch (err) {
      results.push({ studentId, summary: `FAILED: ${(err as Error).message.slice(0, 200)}` });
    }
  }

  await writeAudit(db, {
    actorType: "system",
    action: "weekly_synthesis_run",
    entityType: "synthesis_batch",
    entityId: batchId,
    details: { students: studentIds.length },
  });

  return Response.json({ batchId, students: studentIds.length, results });
}
