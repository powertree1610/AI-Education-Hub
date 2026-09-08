import "server-only";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { parseLocalUrl, writeAudit } from "@platform/shared";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { resolveOcrModel } from "./license";
import { ocrImage, ocrPdf } from "./ocr";

/**
 * OCR a teaching material ONCE and persist the text (core.teaching_material_texts,
 * migration 0009 — v6). Mirrors extract-sample-text, with one deliberate
 * difference: NO consent gate. A material is teacher-authored content FOR the
 * child (worksheet, reading), not the child's personal data. Never throws —
 * an extraction failure must not break an upload or a chat turn.
 */
export async function extractAndStoreMaterialText(
  materialId: string,
  requestedBy?: string | null,
): Promise<string | null> {
  try {
    const db = getDb();
    const material = (
      await db
        .select()
        .from(s.teachingMaterials)
        .where(eq(s.teachingMaterials.id, materialId))
        .limit(1)
    )[0];
    if (!material?.fileUrl) return null;
    if (material.scanStatus !== "clean") return null;

    const key = parseLocalUrl(material.fileUrl);
    if (!key) return null;
    const file = await getStorage().get(key);
    if (!file) return null;

    const mime = material.fileType ?? "application/octet-stream";
    const usageContext = {
      feature: "ocr",
      userId: requestedBy ?? null,
      studentId: material.studentId,
      refId: materialId,
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
      .insert(s.teachingMaterialTexts)
      .values({
        materialId,
        extractedText: extracted,
        extractionModel: (await resolveOcrModel()).slice(0, 128),
        pageCount,
        truncated,
      })
      .onConflictDoUpdate({
        target: s.teachingMaterialTexts.materialId,
        set: { extractedText: extracted, pageCount, truncated, extractedAt: new Date().toISOString() },
      });
    await writeAudit(db, {
      actorType: "system",
      action: "material_text_extracted",
      entityType: "teaching_material",
      entityId: materialId,
      details: { pageCount, truncated },
    });
    return extracted;
  } catch (err) {
    console.error("[extract-material-text] failed:", (err as Error).message);
    return null;
  }
}
