/**
 * Safety action policy for kiosk content classification — pure, so the
 * thresholds are testable and reviewable in one place.
 *
 * Ladder: severity 1–2 allowed (recorded only), 3 redirected, 4–5 blocked
 * + escalated to safeguarding. Child-disclosure categories escalate a step
 * early because the cost of missing one is unacceptable.
 */

/** Mirrors core.safety_category (PM-approved enum). */
export type SafetyCategory =
  | "sexual_content"
  | "violence"
  | "self_harm"
  | "harassment_bullying"
  | "hate"
  | "personal_information"
  | "off_topic_adult"
  | "prompt_injection"
  | "disclosure"
  | "malware"
  | "nsfw_image"
  | "unsupported_file";

export const SAFETY_CATEGORIES: readonly SafetyCategory[] = [
  "sexual_content",
  "violence",
  "self_harm",
  "harassment_bullying",
  "hate",
  "personal_information",
  "off_topic_adult",
  "prompt_injection",
  "disclosure",
  "malware",
  "nsfw_image",
  "unsupported_file",
];

export interface SafetyDecision {
  action: "allowed" | "redirected" | "blocked";
  escalate: boolean;
}

const EARLY_ESCALATION: ReadonlySet<SafetyCategory> = new Set(["self_harm", "disclosure"]);

export function decideSafetyAction(category: SafetyCategory, severity: number): SafetyDecision {
  if (severity >= 4 || (EARLY_ESCALATION.has(category) && severity >= 3)) {
    return { action: "blocked", escalate: true };
  }
  if (severity === 3) return { action: "redirected", escalate: false };
  return { action: "allowed", escalate: false };
}
