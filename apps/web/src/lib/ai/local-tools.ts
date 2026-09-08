import "server-only";
import { eq } from "drizzle-orm";
import { schema as s } from "@platform/db";
import { canUserAccessStudent, checkConsent, parseLocalUrl } from "@platform/shared";
import type { AppUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import type { OpenAiTool } from "./central-api";
import { extractAndStoreSampleText } from "./extract-sample-text";
import { ocrImage, ocrPdf } from "./ocr";

/**
 * App-side (non-MCP) tools. read_work_sample_file is load-bearing: the chat
 * model cannot see images and cannot open local:// URLs — this tool reads the
 * file from storage, OCRs it via the licensed vision model, and returns text.
 */

export const LOCAL_TOOLS: OpenAiTool[] = [
  {
    type: "function",
    function: {
      name: "read_work_sample_file",
      description:
        "Read the actual content of an uploaded work sample (image or PDF). Returns the transcribed " +
        "text including spelling mistakes and teacher annotations. Use get_work_samples first to find " +
        "the work_sample_id, then this to read it before analysing.",
      parameters: {
        type: "object",
        properties: {
          work_sample_id: { type: "string", description: "UUID from get_work_samples" },
        },
        required: ["work_sample_id"],
        additionalProperties: false,
      },
    },
  },
];

export function isLocalTool(name: string): boolean {
  return LOCAL_TOOLS.some((t) => t.function.name === name);
}

export async function callLocalTool(
  name: string,
  args: Record<string, unknown>,
  user: AppUser,
): Promise<{ text: string; isError: boolean }> {
  if (name === "read_work_sample_file") {
    return readWorkSampleFile(String(args.work_sample_id ?? ""), user);
  }
  return { text: JSON.stringify({ error: `Unknown local tool: ${name}` }), isError: true };
}

async function readWorkSampleFile(
  workSampleId: string,
  user: AppUser,
): Promise<{ text: string; isError: boolean }> {
  const db = getDb();
  const sample = (
    await db.select().from(s.workSamples).where(eq(s.workSamples.id, workSampleId)).limit(1)
  )[0];
  if (!sample) return { text: JSON.stringify({ error: "Work sample not found" }), isError: true };
  if (sample.scanStatus !== "clean") {
    return { text: JSON.stringify({ error: "File has not passed upload scanning" }), isError: true };
  }

  if (user.role === "teacher") {
    const allowed = await canUserAccessStudent(db, {
      userId: user.id,
      role: "teacher",
      studentId: sample.studentId,
    });
    if (!allowed) {
      return {
        text: JSON.stringify({ error: "You do not have access to this student's work" }),
        isError: true,
      };
    }
  }

  // Consent gate (v5 retrofit): same posture as the MCP analysis tools.
  const { granted, missing } = await checkConsent(db, sample.studentId, [
    "work_uploads",
    "ai_work_analysis",
  ]);
  if (!granted) {
    return {
      text: JSON.stringify({ code: "CONSENT_NOT_GRANTED", missing }),
      isError: true,
    };
  }

  // v5: cached extraction first (written at upload); no re-billing.
  const cached = (
    await db
      .select({ extractedText: s.workSampleTexts.extractedText })
      .from(s.workSampleTexts)
      .where(eq(s.workSampleTexts.workSampleId, workSampleId))
      .limit(1)
  )[0];
  if (cached) {
    return {
      text: JSON.stringify({
        work_sample_id: workSampleId,
        title_topic: sample.titleTopic,
        work_type: sample.workType,
        extracted_content: cached.extractedText,
        cached: true,
      }),
      isError: false,
    };
  }

  // Write-through backfill for pre-v5 samples: extract + persist, so the
  // next read is free.
  const stored = await extractAndStoreSampleText(workSampleId, user.id);
  if (stored) {
    return {
      text: JSON.stringify({
        work_sample_id: workSampleId,
        title_topic: sample.titleTopic,
        work_type: sample.workType,
        extracted_content: stored,
        cached: false,
      }),
      isError: false,
    };
  }

  // Last resort: live OCR without persistence (unchanged pre-v5 behaviour).
  const key = parseLocalUrl(sample.fileUrl);
  if (!key) return { text: JSON.stringify({ error: "Unsupported file URL scheme" }), isError: true };
  const file = await getStorage().get(key);
  if (!file) return { text: JSON.stringify({ error: "File missing from storage" }), isError: true };

  const mime = sample.fileType ?? "application/octet-stream";
  const usageContext = {
    feature: "ocr",
    userId: user.id,
    studentId: sample.studentId,
    refId: workSampleId,
  };
  let extracted: string;
  if (mime === "application/pdf") {
    extracted = await ocrPdf(file.data, usageContext);
  } else if (mime.startsWith("image/")) {
    extracted = await ocrImage(`data:${mime};base64,${file.data.toString("base64")}`, usageContext);
  } else {
    return { text: JSON.stringify({ error: `Unsupported file type: ${mime}` }), isError: true };
  }

  return {
    text: JSON.stringify({
      work_sample_id: workSampleId,
      title_topic: sample.titleTopic,
      work_type: sample.workType,
      extracted_content: extracted || "(no text could be extracted)",
    }),
    isError: false,
  };
}
