/**
 * Safety action policy for kiosk content classification — pure, so the
 * thresholds are testable and reviewable in one place.
 *
 * Ladder: severity 1–2 allowed (recorded only), 3 redirected, 4–5 escalated
 * to safeguarding. Child-disclosure categories escalate a step early because
 * the cost of missing one is unacceptable.
 */

/** Mirrors core.safety_category (PM-approved enum). The type derives from
 *  the array so a category can never exist in one and not the other. */
export const SAFETY_CATEGORIES = [
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
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

/** Mirrors restricted.safeguarding_status — single source for the action
 *  validator, the status dropdown, and the open-case predicates. */
export const SAFEGUARDING_STATUSES = [
  "open",
  "under_review",
  "actioned",
  "closed",
  "escalated",
] as const;

export type SafeguardingStatus = (typeof SAFEGUARDING_STATUSES)[number];

export const OPEN_SAFEGUARDING_STATUSES: readonly SafeguardingStatus[] = [
  "open",
  "under_review",
  "escalated",
];

export function isOpenStatus(status: string): boolean {
  return (OPEN_SAFEGUARDING_STATUSES as readonly string[]).includes(status);
}

export interface SafetyDecision {
  /** Matches core.safety_action as persisted — what actually happened. */
  action: "allowed" | "redirected" | "escalated";
  escalate: boolean;
}

const EARLY_ESCALATION: ReadonlySet<SafetyCategory> = new Set(["self_harm", "disclosure"]);

export function decideSafetyAction(category: SafetyCategory, severity: number): SafetyDecision {
  if (severity >= 4 || (EARLY_ESCALATION.has(category) && severity >= 3)) {
    return { action: "escalated", escalate: true };
  }
  if (severity === 3) return { action: "redirected", escalate: false };
  return { action: "allowed", escalate: false };
}
