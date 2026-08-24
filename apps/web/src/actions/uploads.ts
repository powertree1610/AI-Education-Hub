"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, formatLocalUrl, writeAudit } from "@platform/shared";
import { requireAppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isChildOfGuardianUser } from "@/lib/parents";
import { getStorage } from "@/lib/storage";

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

type WorkType = (typeof s.workTypeInCore.enumValues)[number];
type WorkSource = (typeof s.workSourceInCore.enumValues)[number];

export async function uploadWorkSampleAction(formData: FormData) {
  const user = await requireAppUser("admin", "teacher", "guardian");
  const db = getDb();

  const studentId = String(formData.get("studentId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected");
  if (file.size > MAX_BYTES) throw new Error("File exceeds the 15 MB limit");

  if (user.role === "guardian") {
    const { ok } = await isChildOfGuardianUser(db, user.id, studentId);
    if (!ok) throw new Error("Not your child");
  } else if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, { userId: user.id, role: "teacher", studentId });
    if (!allowed) throw new Error("You are not assigned to this student");
  }

  const ext = ALLOWED_MIME[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type || "unknown"} (JPG, PNG, WebP or PDF)`);

  const workType = String(formData.get("workType") ?? "") as WorkType;
  if (!s.workTypeInCore.enumValues.includes(workType)) throw new Error("Invalid work type");
  // Parents always upload as "home" — they cannot label work as school/centre.
  const source =
    user.role === "guardian"
      ? ("home" as WorkSource)
      : ((String(formData.get("source") ?? "") || "centre") as WorkSource);
  if (!s.workSourceInCore.enumValues.includes(source)) throw new Error("Invalid source");
  const subjectId = String(formData.get("subjectId") ?? "") || null;

  const key = `${studentId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await getStorage().put(key, bytes, file.type);

  const [sample] = await db
    .insert(s.workSamples)
    .values({
      studentId,
      subjectId,
      workType,
      titleTopic: String(formData.get("titleTopic") ?? "").trim() || null,
      workDate: String(formData.get("workDate") ?? "") || null,
      schoolYear: String(formData.get("schoolYear") ?? "").trim() || null,
      source,
      submittedBy: user.id,
      fileUrl: formatLocalUrl(key),
      fileType: file.type,
      // v1: mime/size validation only — real malware/NSFW scanning is a later
      // phase. upload_scans records what was (and wasn't) checked.
      scanStatus: "clean",
    })
    .returning({ id: s.workSamples.id });

  await db.insert(s.uploadScans).values({
    workSampleId: sample!.id,
    verdict: "clean",
    mimeDetected: file.type,
    sizeBytes: file.size,
    malwareScan: "not_scanned_v1",
    imageScan: "not_scanned_v1",
    details: { validated: ["mime_allowlist", "size_limit"] },
  });

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "uploaded_work_sample",
    entityType: "work_sample",
    entityId: sample!.id,
    details: { studentId, workType, sizeBytes: file.size },
  });

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/parent/children/${studentId}`);
}
