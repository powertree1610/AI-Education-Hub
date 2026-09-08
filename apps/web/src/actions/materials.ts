"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, formatLocalUrl, writeAudit } from "@platform/shared";
import { extractAndStoreMaterialText } from "@/lib/ai/extract-material-text";
import { requireAppUser, type AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";

/**
 * Teaching materials (v6): teacher-authored tasks for a specific student that
 * power the Learning Workspace. The attachment is optional — a material can
 * be instructions-only. Lifecycle is is_active (deactivate, never delete) so
 * Learn sessions and goals keep their references.
 */

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

async function requireStaffForStudent(user: AppUser, studentId: string) {
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(getDb(), {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }
}

export async function createTeachingMaterialAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) throw new Error("Student is required");
  await requireStaffForStudent(user, studentId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("A title is required");
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const subjectId = String(formData.get("subjectId") ?? "") || null;
  const dueDate = String(formData.get("dueDate") ?? "") || null;

  let fileUrl: string | null = null;
  let fileType: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) throw new Error("File exceeds the 15 MB limit");
    const ext = ALLOWED_MIME[file.type];
    if (!ext) throw new Error(`Unsupported file type: ${file.type || "unknown"} (JPG, PNG, WebP or PDF)`);
    // Materials live under a dedicated prefix so the files route can grant
    // the student read access to material files WITHOUT opening their work
    // samples (both would otherwise share the <studentId>/ prefix).
    const key = `materials/${studentId}/${randomUUID()}.${ext}`;
    await getStorage().put(key, new Uint8Array(await file.arrayBuffer()), file.type);
    fileUrl = formatLocalUrl(key);
    fileType = file.type;
  }
  if (!fileUrl && !instructions) {
    throw new Error("A material needs instructions, a file, or both");
  }

  const [material] = await db
    .insert(s.teachingMaterials)
    .values({
      studentId,
      subjectId,
      title: title.slice(0, 300),
      instructions,
      fileUrl,
      fileType,
      // Same v1 posture as work samples: mime/size validation only for now.
      scanStatus: fileUrl ? "clean" : "pending",
      dueDate,
      createdBy: user.id,
    })
    .returning({ id: s.teachingMaterials.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "material_created",
    entityType: "teaching_material",
    entityId: material!.id,
    details: { studentId, title: title.slice(0, 300), hasFile: !!fileUrl },
  });

  // OCR once at upload; the Learn session then reads the cached text.
  if (fileUrl) {
    const materialId = material!.id;
    after(() => extractAndStoreMaterialText(materialId, user.id));
  }

  revalidatePath(`/teacher/students/${studentId}`);
}

export async function setMaterialActiveAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const materialId = String(formData.get("materialId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  const db = getDb();
  const material = (
    await db.select().from(s.teachingMaterials).where(eq(s.teachingMaterials.id, materialId)).limit(1)
  )[0];
  if (!material) throw new Error("Material not found");
  await requireStaffForStudent(user, material.studentId);

  await db
    .update(s.teachingMaterials)
    .set({ isActive })
    .where(eq(s.teachingMaterials.id, materialId));
  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: isActive ? "material_reactivated" : "material_deactivated",
    entityType: "teaching_material",
    entityId: materialId,
  });
  revalidatePath(`/teacher/students/${material.studentId}`);
}

/**
 * "Set goal based on material" (v6): a teacher-created goal born active —
 * the teacher IS the lifecycle owner, so propose+activate in one act.
 */
export async function proposeGoalFromMaterialAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const materialId = String(formData.get("materialId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("A goal title is required");
  const targetDate = String(formData.get("targetDate") ?? "") || null;

  const db = getDb();
  const material = (
    await db.select().from(s.teachingMaterials).where(eq(s.teachingMaterials.id, materialId)).limit(1)
  )[0];
  if (!material) throw new Error("Material not found");
  await requireStaffForStudent(user, material.studentId);

  const [goal] = await db
    .insert(s.goals)
    .values({
      studentId: material.studentId,
      goalType: "academic",
      subjectId: material.subjectId,
      title: title.slice(0, 300),
      description: `Based on material: ${material.title}`,
      requestedByRole: "teacher",
      requestedByUser: user.id,
      status: "active",
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: targetDate ?? material.dueDate,
      materialId,
    })
    .returning({ id: s.goals.id });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "goal_created",
    entityType: "goal",
    entityId: goal!.id,
    details: { studentId: material.studentId, materialId, status: "active" },
  });
  revalidatePath(`/teacher/students/${material.studentId}`);
}
