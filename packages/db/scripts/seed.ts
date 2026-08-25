/**
 * Idempotent seed: reference data + one user per role.
 * Runs as the DB OWNER role (DATABASE_URL). Safe to run repeatedly.
 *
 * Deliberately NO demo student data — real students, guardians and consents
 * are entered through the admin portal, which doubles as the end-to-end test
 * of that flow.
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/client.js";
import * as s from "../src/schema/index.js";
import { requireEnv } from "./env.js";

const { db, pool } = createDb({ connectionString: requireEnv("DATABASE_URL") });

// Design doc §8.1 subjects list.
const SUBJECTS: { code: string; name: string }[] = [
  { code: "BM", name: "Bahasa Melayu" },
  { code: "ENG", name: "English" },
  { code: "MATH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "CHI", name: "Chinese" },
  { code: "HIST", name: "History" },
  { code: "GEO", name: "Geography" },
  { code: "MORAL", name: "Moral Education" },
  { code: "ISLAM", name: "Islamic Education" },
  { code: "ICT", name: "ICT" },
  { code: "GK", name: "General Knowledge" },
  { code: "OTHER", name: "Other" },
];

const INTERESTS: { name: string; category: "sports" | "tech" | "arts" | "academic" | "other" }[] = [
  { name: "Badminton", category: "sports" },
  { name: "Football", category: "sports" },
  { name: "Swimming", category: "sports" },
  { name: "Drawing", category: "arts" },
  { name: "Singing", category: "arts" },
  { name: "Roblox", category: "tech" },
  { name: "Minecraft", category: "tech" },
  { name: "Dinosaurs", category: "academic" },
  { name: "Reading", category: "academic" },
  { name: "Chess", category: "academic" },
];

const TRAITS: {
  key: string;
  label: string;
  traitGroup: "personality" | "behaviour" | "social" | "communication" | "emotional";
  valueType: "checkbox" | "scale_1_5";
}[] = [
  { key: "confident_speaking", label: "Confident when speaking up", traitGroup: "communication", valueType: "scale_1_5" },
  { key: "works_independently", label: "Works without being prompted", traitGroup: "behaviour", valueType: "scale_1_5" },
  { key: "distracted_easily", label: "Easily distracted", traitGroup: "behaviour", valueType: "checkbox" },
  { key: "helps_others", label: "Helps classmates", traitGroup: "social", valueType: "checkbox" },
  { key: "shy_new_people", label: "Shy with new people", traitGroup: "personality", valueType: "checkbox" },
  { key: "manages_frustration", label: "Manages frustration well", traitGroup: "emotional", valueType: "scale_1_5" },
];

async function ensureBranch(name: string): Promise<string> {
  const existing = await db.select().from(s.branches).where(eq(s.branches.name, name));
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(s.branches).values({ name }).returning();
  return row!.id;
}

async function ensureUser(u: {
  email?: string;
  username?: string;
  role: "admin" | "teacher" | "guardian" | "student";
  name: string;
}): Promise<string> {
  const match = u.email ? eq(s.users.email, u.email) : eq(s.users.username, u.username!);
  const existing = await db.select().from(s.users).where(match);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(s.users)
    .values({ email: u.email, username: u.username, role: u.role, name: u.name })
    .returning();
  return row!.id;
}

async function main() {
  console.log("Seeding reference data…");

  await db.insert(s.subjects).values(SUBJECTS).onConflictDoNothing({ target: s.subjects.code });
  await db.insert(s.interests).values(INTERESTS).onConflictDoNothing({ target: s.interests.name });
  await db.insert(s.traits).values(TRAITS).onConflictDoNothing({ target: s.traits.key });

  const branchId = await ensureBranch("Main Centre");
  console.log(`Branch "Main Centre": ${branchId}`);

  // One user per role. Emails are the JIT-binding key for Clerk sign-in
  // (lib/auth.ts matches by email and backfills auth_identity on first login).
  const adminId = await ensureUser({ email: "admin@powertree.com.my", role: "admin", name: "Admin" });

  const teacherId = await ensureUser({ email: "teacher@example.com", role: "teacher", name: "Teacher One" });
  await db
    .insert(s.staffProfiles)
    .values({ userId: teacherId, branchId, position: "Teacher" })
    .onConflictDoNothing({ target: s.staffProfiles.userId });

  // Safeguarding lead: a senior staff account with the module flag (design §4).
  const leadId = await ensureUser({ email: "lead@example.com", role: "teacher", name: "Safeguarding Lead" });
  await db
    .insert(s.staffProfiles)
    .values({ userId: leadId, branchId, position: "Senior Teacher", isSafeguardingLead: true })
    .onConflictDoUpdate({ target: s.staffProfiles.userId, set: { isSafeguardingLead: true } });

  const guardianUserId = await ensureUser({ email: "parent@example.com", role: "guardian", name: "Parent One" });
  await db
    .insert(s.guardians)
    .values({ userId: guardianUserId, name: "Parent One", email: "parent@example.com" })
    .onConflictDoNothing({ target: s.guardians.userId });

  const studentUserId = await ensureUser({ username: "student1", role: "student", name: "Student One" });
  await db
    .insert(s.students)
    .values({
      studentCode: "ST-0001",
      branchId,
      fullName: "Student One",
      preferredName: "Student",
      dob: "2016-01-01",
      userId: studentUserId,
      preferredAiLanguage: "English",
    })
    .onConflictDoNothing({ target: s.students.studentCode });

  console.log(`Users — admin: ${adminId}, teacher: ${teacherId}, guardian: ${guardianUserId}, student: ${studentUserId}`);
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
