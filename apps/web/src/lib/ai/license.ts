import "server-only";

/**
 * License validation against the Central AI API Server — ported from the ERP
 * implementation minus the MSSQL CompanyProfile binding: v1 reuses the
 * existing license key BIND-LESS (databaseCompanyName is simply not sent;
 * the Central API accepts that). Proper student-platform product licensing
 * is deferred — see the plan's risk list.
 */

export interface LicenseRecord {
  licenseKey: string;
  companyName: string | null;
  licenseStatus: string | null;
  licenseType: string | null;
  expiryDate: string | null;
  ocrModel: string | null;
  defaultModelId: string | null;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

const globalForLicense = globalThis as unknown as {
  __license?: { record: LicenseRecord; fetchedAt: number };
};

export async function validateLicense(): Promise<LicenseRecord> {
  const apiUrl = (process.env.AI_API_SERVER_URL ?? "").replace(/\/+$/, "");
  const licenseKey = (process.env.LICENSE_KEY ?? "").trim();
  if (!apiUrl) throw new Error("AI_API_SERVER_URL is not configured.");
  if (!licenseKey) throw new Error("LICENSE_KEY is not configured.");

  const res = await fetch(`${apiUrl}/api/license/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyTin: licenseKey }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as {
    valid: boolean;
    error?: string;
    license?: Record<string, unknown>;
  };
  if (!data.valid || !data.license) {
    throw new Error(data.error || "License validation failed.");
  }
  const lic = data.license;
  const record: LicenseRecord = {
    licenseKey: String(lic.licenseKey ?? licenseKey),
    companyName: (lic.companyName as string) ?? null,
    licenseStatus: (lic.licenseStatus as string) ?? null,
    licenseType: (lic.licenseType as string) ?? null,
    expiryDate: (lic.expiryDate as string) ?? null,
    ocrModel: (lic.ocrModel as string) ?? null,
    defaultModelId: (lic.defaultModelId as string) ?? null,
  };
  globalForLicense.__license = { record, fetchedAt: Date.now() };
  return record;
}

/** Cached license (30-min TTL, matching the ERP watchdog cadence). Returns
 *  null when validation fails so callers can degrade with a clear message. */
export async function getLicense(): Promise<LicenseRecord | null> {
  const cached = globalForLicense.__license;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.record;
  try {
    return await validateLicense();
  } catch (err) {
    console.error("[license] validation failed:", (err as Error).message);
    return cached?.record ?? null;
  }
}

/** Model resolution, ported precedence: license > env > fallback.
 *  (The ERP also consults a DB settings table — v1 here has no settings UI.) */
export async function resolveChatModel(surface: "staff" | "kiosk"): Promise<string> {
  const override =
    surface === "staff" ? process.env.STAFF_MODEL : process.env.KIOSK_MODEL;
  if (override) return override;
  const license = await getLicense();
  return license?.defaultModelId || process.env.DEFAULT_MODEL || "deepseek-v4-flash";
}

export async function resolveOcrModel(): Promise<string> {
  const license = await getLicense();
  return license?.ocrModel || process.env.OCR_MODEL || "gpt-4o-mini";
}
