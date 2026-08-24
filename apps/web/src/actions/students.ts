"use server";

import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { CONSENT_TYPES, writeAudit, type ConsentType } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function nextStudentCode(db: ReturnType<typeof getDb>): Promise<string> {
  const last = await db
    .select({ code: s.students.studentCode })
    .from(s.students)
    .orderBy(desc(s.students.createdAt))
    .limit(1);
  const match = last[0]?.code.match(/(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `ST-${String(next).padStart(4, "0")}`;
}

export async function createStudentAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const fullName = str(formData, "fullName");
  const dob = str(formData, "dob");
  if (!fullName || !dob) throw new Error("Full name and date of birth are required");

  const branch = (await db.select().from(s.branches).limit(1))[0];
  if (!branch) throw new Error("No branch exists — run the seed first");

  const studentCode = str(formData, "studentCode") || (await nextStudentCode(db));

  const guardianName = str(formData, "guardianName");
  const grantedTypes = CONSENT_TYPES.filter((t) => formData.get(`consent_${t}`) === "on");

  const studentId = await db.transaction(async (tx) => {
    const [student] = await tx
      .insert(s.students)
      .values({
        studentCode,
        branchId: branch.id,
        fullName,
        preferredName: str(formData, "preferredName") || null,
        dob,
        gender: str(formData, "gender") || null,
        programme: str(formData, "programme") || null,
        schoolName: str(formData, "schoolName") || null,
        schoolGrade: str(formData, "schoolGrade") || null,
        preferredAiLanguage: str(formData, "preferredAiLanguage") || null,
      })
      .returning({ id: s.students.id });

    let guardianId: string | null = null;
    if (guardianName) {
      const [guardian] = await tx
        .insert(s.guardians)
        .values({
          name: guardianName,
          phone: str(formData, "guardianPhone") || null,
          email: str(formData, "guardianEmail") || null,
        })
        .returning({ id: s.guardians.id });
      guardianId = guardian!.id;

      await tx.insert(s.studentGuardians).values({
        studentId: student!.id,
        guardianId,
        relationship: str(formData, "guardianRelationship") || "Guardian",
        isPrimary: true,
        isEmergencyContact: true,
        emergencyPriority: 1,
      });

      // Paper consents recorded by the admin during registration (append-only).
      if (grantedTypes.length > 0) {
        await tx.insert(s.consents).values(
          grantedTypes.map((consentType) => ({
            studentId: student!.id,
            guardianId: guardianId!,
            consentType,
            status: "granted" as const,
            method: "paper" as const,
            grantedAt: new Date().toISOString(),
            recordedBy: admin.id,
          })),
        );
      }
    }

    return student!.id;
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: "created_student",
    entityType: "student",
    entityId: studentId,
    details: { studentCode, consentsRecorded: grantedTypes.length },
  });

  redirect(`/admin/students/${studentId}`);
}

/** Append-only consent change (paper record by admin). */
export async function setConsentAction(formData: FormData) {
  const admin = await requireAppUser("admin");
  const db = getDb();

  const studentId = str(formData, "studentId");
  const consentType = str(formData, "consentType") as ConsentType;
  const status = str(formData, "status");
  if (!CONSENT_TYPES.includes(consentType)) throw new Error("Unknown consent type");
  if (status !== "granted" && status !== "withdrawn") throw new Error("Invalid status");

  const link = await db
    .select({ guardianId: s.studentGuardians.guardianId })
    .from(s.studentGuardians)
    .where(eq(s.studentGuardians.studentId, studentId))
    .limit(1);
  if (!link[0]) throw new Error("Student has no guardian on record — add one first");

  await db.insert(s.consents).values({
    studentId,
    guardianId: link[0].guardianId,
    consentType,
    status,
    method: "paper",
    grantedAt: status === "granted" ? new Date().toISOString() : null,
    withdrawnAt: status === "withdrawn" ? new Date().toISOString() : null,
    recordedBy: admin.id,
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: admin.id,
    action: status === "granted" ? "recorded_consent" : "withdrew_consent",
    entityType: "consent",
    entityId: studentId,
    details: { type: consentType },
  });

  revalidatePath(`/admin/students/${studentId}`);
}
