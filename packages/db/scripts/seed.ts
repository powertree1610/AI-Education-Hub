/**
 * Idempotent seed for the v7 schema: reference data, one account per role,
 * demo students with schools/consents/home-mode settings, and enough history
 * (levels, goals, results, materials) that dashboards and the development
 * timeline have something to show.
 *
 * Runs as the DB OWNER role (DATABASE_URL). Safe to run repeatedly:
 * existing rows are kept, and passwords are only set on rows this script
 * CREATES — it never overwrites a password someone already has.
 * Dev passwords follow docs/dev-pw.txt conventions (<name>123).
 */
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
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

const SCHOOLS: { name: string; schoolType: string; curriculum: string }[] = [
  { name: "SK Taman Molek", schoolType: "primary_national", curriculum: "KSSR" },
  { name: "SJKC Foon Yew 5", schoolType: "primary_chinese", curriculum: "KSSR" },
  { name: "SJKC Kuo Kuang 2", schoolType: "primary_chinese", curriculum: "KSSR" },
];

const FULL_CONSENTS = [
  "basic_profile",
  "academic_data",
  "work_uploads",
  "ai_work_analysis",
  "ai_interaction",
  "conversation_storage",
  "development_tracking",
  "progress_reports",
] as const;

async function ensureBranch(name: string): Promise<string> {
  const existing = await db.select().from(s.branches).where(eq(s.branches.name, name));
  if (existing[0]) return existing[0].id;
  const [row] = await db.insert(s.branches).values({ name }).returning();
  return row!.id;
}

/** Create-or-fetch a user; the password applies ONLY when the row is created. */
async function ensureUser(u: {
  email?: string;
  username?: string;
  role: "admin" | "teacher" | "guardian" | "student";
  name: string;
  password?: string;
}): Promise<string> {
  const match = u.email ? eq(s.users.email, u.email) : eq(s.users.username, u.username!);
  const existing = await db.select().from(s.users).where(match);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(s.users)
    .values({
      email: u.email,
      username: u.username,
      role: u.role,
      name: u.name,
      passwordHash: u.password ? await bcrypt.hash(u.password, 10) : undefined,
    })
    .returning();
  console.log(`  user created: ${u.email ?? u.username} (${u.role})${u.password ? ` pw=${u.password}` : ""}`);
  return row!.id;
}

async function ensureStudent(v: {
  studentCode: string;
  branchId: string;
  fullName: string;
  preferredName: string;
  dob: string;
  schoolGrade: string;
  schoolId: string | null;
  userId?: string | null;
  preferredAiLanguage?: string;
  aiAccessLevel?: "academic_only" | "academic_general" | "full";
  unsupervisedAccessEnabled?: boolean;
  defaultAssistMode?: "learning" | "practice" | "assessment";
  maxSessionMinutes?: number;
}): Promise<string> {
  const existing = await db.select().from(s.students).where(eq(s.students.studentCode, v.studentCode));
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(s.students)
    .values({ ...v, preferredAiLanguage: v.preferredAiLanguage ?? "English" })
    .returning();
  return row!.id;
}

async function ensureSubjectId(code: string): Promise<string> {
  const [row] = await db.select().from(s.subjects).where(eq(s.subjects.code, code));
  return row!.id;
}

async function grantConsents(studentId: string, guardianId: string, recordedBy: string, types: readonly string[]) {
  for (const t of types) {
    const existing = await db
      .select({ id: s.consents.id })
      .from(s.consents)
      .where(and(eq(s.consents.studentId, studentId), eq(s.consents.consentType, t as (typeof FULL_CONSENTS)[number])))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(s.consents).values({
      studentId,
      guardianId,
      consentType: t as (typeof FULL_CONSENTS)[number],
      status: "granted",
      grantedAt: new Date().toISOString(),
      recordedBy,
    });
  }
}

async function main() {
  console.log("Seeding reference data…");
  await db.insert(s.subjects).values(SUBJECTS).onConflictDoNothing({ target: s.subjects.code });
  await db.insert(s.interests).values(INTERESTS).onConflictDoNothing({ target: s.interests.name });
  await db.insert(s.traits).values(TRAITS).onConflictDoNothing({ target: s.traits.key });
  for (const school of SCHOOLS) {
    const existing = await db.select().from(s.schools).where(eq(s.schools.name, school.name));
    if (!existing[0]) await db.insert(s.schools).values(school);
  }
  const branchId = await ensureBranch("Main Centre");
  const schoolRows = await db.select().from(s.schools);
  const schoolId = (name: string) => schoolRows.find((r) => r.name === name)?.id ?? null;
  const mathId = await ensureSubjectId("MATH");
  const engId = await ensureSubjectId("ENG");

  console.log("Seeding accounts…");
  // Admin: row only — the password is the owner's own, never set here.
  await ensureUser({ email: "admin@powertree.com.my", role: "admin", name: "Admin" });

  const teacherId = await ensureUser({ email: "teacher@example.com", role: "teacher", name: "Teacher One", password: "teacher123" });
  await db
    .insert(s.staffProfiles)
    .values({ userId: teacherId, branchId, position: "Teacher" })
    .onConflictDoNothing({ target: s.staffProfiles.userId });

  const leadId = await ensureUser({ email: "lead@example.com", role: "teacher", name: "Safeguarding Lead", password: "lead1234" });
  await db
    .insert(s.staffProfiles)
    .values({ userId: leadId, branchId, position: "Senior Teacher", isSafeguardingLead: true })
    .onConflictDoUpdate({ target: s.staffProfiles.userId, set: { isSafeguardingLead: true } });

  const parent1UserId = await ensureUser({ email: "parent@example.com", role: "guardian", name: "Encik Rahman", password: "parent123" });
  const parent2UserId = await ensureUser({ email: "parent2@example.com", role: "guardian", name: "Mdm Tan Li Wei", password: "parent123" });

  async function ensureGuardian(userId: string | null, name: string, email?: string): Promise<string> {
    if (userId) {
      const existing = await db.select().from(s.guardians).where(eq(s.guardians.userId, userId));
      if (existing[0]) return existing[0].id;
    } else {
      const existing = await db.select().from(s.guardians).where(eq(s.guardians.name, name));
      if (existing[0]) return existing[0].id;
    }
    const [row] = await db.insert(s.guardians).values({ userId, name, email }).returning();
    return row!.id;
  }
  const g1 = await ensureGuardian(parent1UserId, "Encik Rahman", "parent@example.com");
  const g2 = await ensureGuardian(parent2UserId, "Mdm Tan Li Wei", "parent2@example.com");
  const g3 = await ensureGuardian(null, "Mr Kumar"); // no portal account — paper-only family

  console.log("Seeding students…");
  const aisyahUser = await ensureUser({ username: "aisyah", role: "student", name: "Aisyah Binti Rahman", password: "aisyah123" });
  const junhaoUser = await ensureUser({ username: "junhao", role: "student", name: "Tan Jun Hao", password: "junhao123" });

  const aisyah = await ensureStudent({
    studentCode: "ST-0001",
    branchId,
    fullName: "Aisyah Binti Rahman",
    preferredName: "Aisyah",
    dob: "2017-03-14",
    schoolGrade: "Standard 3",
    schoolId: schoolId("SK Taman Molek"),
    userId: aisyahUser,
    aiAccessLevel: "academic_general",
    unsupervisedAccessEnabled: true,
    defaultAssistMode: "practice",
    maxSessionMinutes: 45,
  });
  const junhao = await ensureStudent({
    studentCode: "ST-0002",
    branchId,
    fullName: "Tan Jun Hao",
    preferredName: "Jun Hao",
    dob: "2016-08-02",
    schoolGrade: "Standard 4",
    schoolId: schoolId("SJKC Foon Yew 5"),
    userId: junhaoUser,
    aiAccessLevel: "full",
    unsupervisedAccessEnabled: true,
    defaultAssistMode: "learning",
    maxSessionMinutes: 30,
  });
  const arjun = await ensureStudent({
    studentCode: "ST-0003",
    branchId,
    fullName: "Arjun A/L Kumar",
    preferredName: "Arjun",
    dob: "2018-11-20",
    schoolGrade: "Standard 2",
    schoolId: schoolId("SK Taman Molek"),
    userId: null, // kiosk-only — no self login yet
    aiAccessLevel: "academic_only",
  });

  const links: [string, string, string][] = [
    [aisyah, g1, "father"],
    [junhao, g2, "mother"],
    [arjun, g3, "father"],
  ];
  for (const [studentId, guardianId, relationship] of links) {
    const existing = await db
      .select({ id: s.studentGuardians.id })
      .from(s.studentGuardians)
      .where(and(eq(s.studentGuardians.studentId, studentId), eq(s.studentGuardians.guardianId, guardianId)));
    if (!existing[0]) {
      await db.insert(s.studentGuardians).values({ studentId, guardianId, relationship, isPrimary: true });
    }
  }

  for (const studentId of [aisyah, junhao, arjun]) {
    const existing = await db
      .select({ id: s.studentTeachers.id })
      .from(s.studentTeachers)
      .where(and(eq(s.studentTeachers.studentId, studentId), eq(s.studentTeachers.userId, teacherId)));
    if (!existing[0]) await db.insert(s.studentTeachers).values({ studentId, userId: teacherId, role: "tutor" });
  }

  console.log("Granting consents…");
  await grantConsents(aisyah, g1, parent1UserId, FULL_CONSENTS);
  await grantConsents(junhao, g2, parent2UserId, FULL_CONSENTS);
  // Arjun deliberately has gaps (no AI interaction / uploads yet) — the admin
  // dashboard's consent-gap card should show him until the family signs.
  await grantConsents(arjun, g3, teacherId, ["basic_profile", "academic_data"]);

  console.log("Seeding history (timeline demo)…");
  const hasHistory = await db.select({ id: s.studentLevels.id }).from(s.studentLevels).where(eq(s.studentLevels.studentId, aisyah)).limit(1);
  if (!hasHistory[0]) {
    await db.insert(s.studentLevels).values([
      { studentId: aisyah, kind: "academic_skill", key: "Maths", subjectId: mathId, score: 2, effectiveFrom: "2026-06-10T09:00:00Z", setByUserId: teacherId },
      { studentId: aisyah, kind: "academic_skill", key: "Maths", subjectId: mathId, score: 3, effectiveFrom: "2026-08-28T09:00:00Z", setByUserId: teacherId },
      { studentId: aisyah, kind: "development_area", key: "Focus", score: 3, effectiveFrom: "2026-07-15T09:00:00Z", setByUserId: teacherId },
      { studentId: junhao, kind: "academic_skill", key: "English", subjectId: engId, score: 4, effectiveFrom: "2026-07-01T09:00:00Z", setByUserId: teacherId },
    ]);

    await db.insert(s.observations).values({
      studentId: aisyah,
      category: "learning_style",
      statement: "Grasps a method fastest after one worked example; struggles when asked to start cold.",
      evidenceSource: "teacher",
      sourceRole: "teacher",
      status: "approved",
      createdAt: "2026-07-22T10:00:00Z",
    });

    const [goal] = await db
      .insert(s.goals)
      .values({
        studentId: aisyah,
        goalType: "academic",
        subjectId: mathId,
        title: "Master the 7 and 8 times tables",
        requestedByRole: "teacher",
        requestedByUser: teacherId,
        status: "active",
        startDate: "2026-08-01",
        targetDate: "2026-10-01",
      })
      .returning({ id: s.goals.id });
    await db.insert(s.auditLog).values([
      { actorType: "user", actorId: teacherId, action: "goal_activated", entityType: "goal", entityId: goal!.id, details: {}, at: "2026-08-01T09:00:00Z" },
    ]);
    await db.insert(s.goalUpdates).values({
      goalId: goal!.id,
      note: "Confident up to the 6s; 7s still shaky.",
      progress: 40,
      updatedBy: teacherId,
      updatedAt: "2026-08-25T09:00:00Z",
    });

    await db.insert(s.academicResults).values([
      { studentId: aisyah, subjectId: mathId, assessmentType: "test", assessmentDate: "2026-08-15", score: "68.00", maxScore: "100.00", source: "centre" },
      { studentId: junhao, subjectId: engId, assessmentType: "exam", assessmentDate: "2026-08-20", score: "85.00", maxScore: "100.00", source: "school" },
    ]);

    await db.insert(s.teachingMaterials).values({
      studentId: aisyah,
      subjectId: mathId,
      title: "Times-table practice sheet (7s & 8s)",
      instructions: "Do one column a day. Say each answer out loud before writing it.",
      dueDate: "2026-09-20",
      createdBy: teacherId,
      scanStatus: "pending",
    });

    const aisyahInterests = await db.select().from(s.interests).where(eq(s.interests.name, "Drawing"));
    if (aisyahInterests[0]) {
      await db.insert(s.studentInterests).values({
        studentId: aisyah,
        interestId: aisyahInterests[0].id,
        kind: "interest",
        source: "parent",
      });
    }
  }

  console.log("Seed complete. Accounts: admin@powertree.com.my (existing pw) · teacher@example.com/teacher123 · lead@example.com/lead1234 · parent@example.com/parent123 (Aisyah) · parent2@example.com/parent123 (Jun Hao) · students: aisyah/aisyah123, junhao/junhao123 · ST-0003 Arjun is kiosk-only with consent gaps (by design).");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
