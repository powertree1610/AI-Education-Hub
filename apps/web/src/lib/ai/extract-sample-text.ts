import "server-only";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { checkConsent, parseLocalUrl, writeAudit } from "@platform/shared";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { resolveOcrModel } from "./license";
import { ocrImage, ocrPdf } from "./ocr";

/**
 * OCR a work sample ONCE and persist the text (core.work_sample_texts,
 * migration 0007) — "convert documents to AI-friendly text first" (v5).
 * Runs in after() post-upload and as a lazy write-through from the AI's
 * read tool. Consent-gated like the analysis tools; never throws — an
 * extraction failure must not break an upload or a chat turn.
 */
export async function extractAndStoreSampleText(
  workSampleId: string,
  requestedBy?: string | null,
): Promise<string | null> {
  try {
    const db = getDb();
    const sample = (
      await db.select().from(s.workSamples).where(eq(s.workSamples.id, workSampleId)).limit(1)
    )[0];
    if (!sample) return null;
    // Extraction waits for the scan gate (v1 stubs it as clean at upload;
    // when real scanning lands this check naturally defers extraction).
    if (sample.scanStatus !== "clean") return null;

    // Same consent posture as the AI work-analysis surface.
    const { granted } = await checkConsent(db, sample.studentId, ["work_uploads", "ai_work_analysis"]);
    if (!granted) return null;

    const key = parseLocalUrl(sample.fileUrl);
    if (!key) return null;
    const file = await getStorage().get(key);
    if (!file) return null;

    const mime = sample.fileType ?? "application/octet-stream";
    const usageContext = {
      feature: "ocr",
      userId: requestedBy ?? null,
      studentId: sample.studentId,
      refId: workSampleId,
    };
    let extracted: string;
    let pageCount: number | null = null;
    if (mime === "application/pdf") {
      extracted = await ocrPdf(file.data, usageContext);
      pageCount = (extracted.match(/── page \d+ ──/g) ?? []).length || null;
    } else if (mime.startsWith("image/")) {
      extracted = await ocrImage(`data:${mime};base64,${file.data.toString("base64")}`, usageContext);
      pageCount = 1;
    } else {
      return null; // unsupported type — nothing to extract
    }
    if (!extracted.trim()) return null;

    const truncated = extracted.includes("10-page OCR limit");
    await db
      .insert(s.workSampleTexts)
      .values({
        workSampleId,
        extractedText: extracted,
        extractionModel: (await resolveOcrModel()).slice(0, 128),
        pageCount,
        truncated,
      })
      .onConflictDoUpdate({
        target: s.workSampleTexts.workSampleId,
        set: { extractedText: extracted, pageCount, truncated, extractedAt: new Date().toISOString() },
      });
    await writeAudit(db, {
      actorType: "system",
      action: "work_sample_text_extracted",
      entityType: "work_sample",
      entityId: workSampleId,
      details: { pageCount, truncated },
    });
    return extracted;
  } catch (err) {
    console.error("[extract-sample-text] failed:", (err as Error).message);
    return null;
  }
}
