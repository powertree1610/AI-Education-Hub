import "server-only";
import { chatCompletion, tokenParamFor } from "./central-api";
import { resolveOcrModel } from "./license";
import type { UsageContext } from "./usage-log";

/**
 * OCR pipeline for student work: the DeepSeek chat models have NO vision, so
 * images/PDFs are read by the licensed OCR model (isOcr: true authorizes it
 * on the Central API) and the extracted text is handed to the chat model.
 * Pattern ported from the ERP orchestrator's PDF OCR fallback.
 */

const OCR_PROMPT =
  "This is a scan or photo of a primary-school student's work. Transcribe ALL text exactly as " +
  "written, preserving line breaks, spelling mistakes and corrections (they matter for analysis). " +
  "Note any teacher marks, scores or annotations. Describe drawings briefly in [brackets]. " +
  "Output plain text only.";

export async function ocrImage(dataUrl: string, usageContext?: UsageContext): Promise<string> {
  const model = await resolveOcrModel();
  const res = await chatCompletion({
    model,
    isOcr: true,
    usageContext: usageContext ?? { feature: "ocr" },
    ...tokenParamFor(model, 4000),
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  return String(res.choices?.[0]?.message?.content ?? "").trim();
}

/** Render each PDF page to PNG and OCR it, preserving page order. */
export async function ocrPdf(buffer: Buffer, usageContext?: UsageContext): Promise<string> {
  const { pdf } = await import("pdf-to-img");
  const pages: string[] = [];
  const document = await pdf(buffer, { scale: 2 });
  let pageNo = 0;
  for await (const image of document) {
    pageNo++;
    const dataUrl = `data:image/png;base64,${Buffer.from(image).toString("base64")}`;
    const text = await ocrImage(dataUrl, usageContext);
    pages.push(`── page ${pageNo} ──\n${text}`);
    if (pageNo >= 10) {
      pages.push("… (remaining pages not read — 10-page OCR limit)");
      break;
    }
  }
  return pages.join("\n\n");
}
