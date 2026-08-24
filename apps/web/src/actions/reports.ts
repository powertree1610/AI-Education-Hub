"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, checkConsent, writeAudit } from "@platform/shared";
import { generateReportDraft } from "@/lib/ai/report-draft";
import { requireAppUser, type AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function guardTeacher(user: AppUser, studentId: string) {
  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(getDb(), {
      userId: user.id,
      role: "teacher",
      studentId,
    });
    if (!allowed) throw new Error("You are not assigned to this student");
  }
}

export async function draftReportAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const studentId = String(formData.get("studentId") ?? "");
  const period = String(formData.get("period") ?? "").trim();
  if (!period) throw new Error("Period is required (e.g. Term 1 2026)");
  await guardTeacher(user, studentId);

  // Consent gate: progress reports are a consented category (M2).
  const { granted } = await checkConsent(db, studentId, ["progress_reports"]);
  if (!granted) throw new Error("progress_reports consent is not granted for this student");

  const { draft, model } = await generateReportDraft(db, studentId, period);

  const [report] = await db
    .insert(s.progressReports)
    .values({
      studentId,
      period,
      generatedBy: "ai",
      status: "pending_review",
      draftContent: draft,
      modelVersion: model,
    })
    .returning({ id: s.progressReports.id });

  await writeAudit(db, {
    actorType: "ai_agent",
    action: "drafted_progress_report",
    entityType: "progress_report",
    entityId: report!.id,
    details: { period },
  });

  revalidatePath(`/teacher/students/${studentId}/reports`);
}

export async function publishReportAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const reportId = String(formData.get("reportId") ?? "");
  const report = (
    await db
      .select()
      .from(s.progressReports)
      .where(and(eq(s.progressReports.id, reportId), eq(s.progressReports.status, "pending_review")))
      .limit(1)
  )[0];
  if (!report) throw new Error("Pending report not found");
  await guardTeacher(user, report.studentId);

  // The teacher's edited version becomes the published content — the AI draft
  // is kept separately in draft_content for the record.
  const content = {
    summary: String(formData.get("summary") ?? "").trim(),
    results_trend: String(formData.get("resultsTrend") ?? "").trim(),
    goals_achieved: Number(formData.get("goalsAchieved") ?? 0) || 0,
    highlights: String(formData.get("highlights") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  };
  if (!content.summary) throw new Error("Summary cannot be empty");

  await db
    .update(s.progressReports)
    .set({
      content,
      status: "published",
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString(),
      publishedBy: user.id,
      publishedAt: new Date().toISOString(),
    })
    .where(eq(s.progressReports.id, reportId));

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "published_progress_report",
    entityType: "progress_report",
    entityId: reportId,
  });

  revalidatePath(`/teacher/students/${report.studentId}/reports`);
  revalidatePath(`/parent/children/${report.studentId}`);
}

export async function archiveReportAction(formData: FormData) {
  const user = await requireAppUser("teacher", "admin");
  const db = getDb();

  const reportId = String(formData.get("reportId") ?? "");
  const report = (
    await db.select().from(s.progressReports).where(eq(s.progressReports.id, reportId)).limit(1)
  )[0];
  if (!report) throw new Error("Report not found");
  await guardTeacher(user, report.studentId);

  await db
    .update(s.progressReports)
    .set({ status: "archived", reviewedBy: user.id, reviewedAt: new Date().toISOString() })
    .where(eq(s.progressReports.id, reportId));

  await writeAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "archived_progress_report",
    entityType: "progress_report",
    entityId: reportId,
  });

  revalidatePath(`/teacher/students/${report.studentId}/reports`);
}
