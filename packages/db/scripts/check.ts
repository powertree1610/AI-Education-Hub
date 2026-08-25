/**
 * Post-seed sanity checks, run as the DB OWNER role:
 *  - seed row counts
 *  - the four views answer
 *  - role grants match the security design, verified via has_table_privilege
 *    (no role passwords needed). The ai_agent boundary is the load-bearing
 *    protection: restricted schema unreadable, profile writes impossible.
 */
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { requireEnv } from "./env.js";

const { db, pool } = createDb({ connectionString: requireEnv("DATABASE_URL") });

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${actual}, expected ${expected})`);
}

async function priv(role: string, table: string, privilege: string): Promise<boolean> {
  const res = await db.execute(
    sql`select has_table_privilege(${role}, ${table}, ${privilege}) as ok`,
  );
  return (res.rows[0] as { ok: boolean }).ok;
}

async function count(table: string): Promise<number> {
  const res = await db.execute(sql.raw(`select count(*)::int as n from ${table}`));
  return (res.rows[0] as { n: number }).n;
}

async function main() {
  console.log("── Seed row counts ──");
  for (const t of ["core.subjects", "core.interests", "core.traits", "core.branches", "core.users"]) {
    const n = await count(t);
    console.log(`${n > 0 ? "PASS" : "FAIL"}  ${t} has rows (${n})`);
    if (n === 0) failures++;
  }

  console.log("── Views answer ──");
  for (const v of [
    "core.v_current_levels",
    "core.v_current_consents",
    "core.v_student_access",
    "core.v_student_current_classes",
  ]) {
    try {
      await db.execute(sql.raw(`select * from ${v} limit 1`));
      console.log(`PASS  ${v} queryable`);
    } catch (err) {
      failures++;
      console.log(`FAIL  ${v} query error: ${(err as Error).message}`);
    }
  }

  console.log("── ai_agent grants (the security boundary) ──");
  expect("ai_agent CANNOT read restricted.health_records", await priv("ai_agent", "restricted.health_records", "SELECT"), false);
  expect("ai_agent CANNOT read restricted.safeguarding_records", await priv("ai_agent", "restricted.safeguarding_records", "SELECT"), false);
  expect("ai_agent can read core.students", await priv("ai_agent", "core.students", "SELECT"), true);
  expect("ai_agent can read core.v_current_consents", await priv("ai_agent", "core.v_current_consents", "SELECT"), true);
  expect("ai_agent can insert core.observations", await priv("ai_agent", "core.observations", "INSERT"), true);
  expect("ai_agent CANNOT update core.observations", await priv("ai_agent", "core.observations", "UPDATE"), false);
  expect("ai_agent can insert core.work_analyses", await priv("ai_agent", "core.work_analyses", "INSERT"), true);
  expect("ai_agent CANNOT update core.ai_sessions", await priv("ai_agent", "core.ai_sessions", "UPDATE"), false);
  expect("ai_agent CANNOT write core.student_levels", await priv("ai_agent", "core.student_levels", "INSERT"), false);
  expect("ai_agent can insert core.audit_log", await priv("ai_agent", "core.audit_log", "INSERT"), true);

  console.log("── v4 safety & safeguarding surface ──");
  try {
    const fn = await db.execute(
      sql`select has_function_privilege('ai_agent', 'core.flag_safeguarding_concern(uuid,text,numeric,uuid)', 'EXECUTE') as ok`,
    );
    expect("ai_agent can EXECUTE core.flag_safeguarding_concern", (fn.rows[0] as { ok: boolean }).ok, true);
  } catch (err) {
    failures++;
    console.log(`FAIL  core.flag_safeguarding_concern(uuid,text,numeric,uuid) missing: ${(err as Error).message}`);
  }
  expect("ai_agent has NO access to core.safety_events", await priv("ai_agent", "core.safety_events", "SELECT"), false);
  expect("app_user can insert core.safety_events", await priv("app_user", "core.safety_events", "INSERT"), true);
  expect("app_user can update core.safety_events (mark reviewed)", await priv("app_user", "core.safety_events", "UPDATE"), true);
  expect("app_user can read restricted.safeguarding_records", await priv("app_user", "restricted.safeguarding_records", "SELECT"), true);
  expect("app_user can insert restricted.safeguarding_records (referrals/escalations)", await priv("app_user", "restricted.safeguarding_records", "INSERT"), true);
  expect("app_user can update restricted.safeguarding_records (status)", await priv("app_user", "restricted.safeguarding_records", "UPDATE"), true);
  expect("app_user can read restricted.safeguarding_reviews", await priv("app_user", "restricted.safeguarding_reviews", "SELECT"), true);
  expect("app_user can insert restricted.safeguarding_reviews", await priv("app_user", "restricted.safeguarding_reviews", "INSERT"), true);

  console.log("── app_user grants ──");
  expect("app_user can read core.students", await priv("app_user", "core.students", "SELECT"), true);
  expect("app_user can insert core.students", await priv("app_user", "core.students", "INSERT"), true);
  expect("app_user can insert core.work_samples", await priv("app_user", "core.work_samples", "INSERT"), true);
  expect("app_user can update core.ai_sessions", await priv("app_user", "core.ai_sessions", "UPDATE"), true);
  expect("app_user can insert core.consents", await priv("app_user", "core.consents", "INSERT"), true);
  expect("app_user can insert core.student_levels", await priv("app_user", "core.student_levels", "INSERT"), true);
  expect("app_user can insert core.ai_usage_logs", await priv("app_user", "core.ai_usage_logs", "INSERT"), true);
  expect("ai_agent has NO access to core.ai_usage_logs", await priv("ai_agent", "core.ai_usage_logs", "SELECT"), false);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("check failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
