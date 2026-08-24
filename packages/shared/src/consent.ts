import { eq } from "drizzle-orm";
import { schema as s, type Db } from "@platform/db";

/** The 11 consent categories, sourced from the live enum. */
export const CONSENT_TYPES = s.consentTypeInCore.enumValues;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export type ConsentStatus = (typeof s.consentStatusInCore.enumValues)[number];

/** Current (latest per type) consent state for one student. */
export async function getCurrentConsents(
  db: Db,
  studentId: string,
): Promise<Map<ConsentType, ConsentStatus>> {
  const rows = await db
    .select({
      consentType: s.vCurrentConsents.consentType,
      status: s.vCurrentConsents.status,
    })
    .from(s.vCurrentConsents)
    .where(eq(s.vCurrentConsents.studentId, studentId));

  const map = new Map<ConsentType, ConsentStatus>();
  for (const row of rows) {
    if (row.consentType && row.status) map.set(row.consentType, row.status);
  }
  return map;
}

export interface ConsentCheckResult {
  granted: boolean;
  /** Required types that are not currently 'granted' (absent row counts as not granted). */
  missing: ConsentType[];
}

/**
 * Opt-in by construction: every required type must be exactly 'granted'.
 * A missing consents row means "never asked" and is treated as not granted.
 */
export async function checkConsent(
  db: Db,
  studentId: string,
  required: readonly ConsentType[],
): Promise<ConsentCheckResult> {
  if (required.length === 0) return { granted: true, missing: [] };
  const current = await getCurrentConsents(db, studentId);
  const missing = required.filter((type) => current.get(type) !== "granted");
  return { granted: missing.length === 0, missing };
}
