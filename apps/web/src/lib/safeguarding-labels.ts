/** One home for safeguarding display labels — the case list, case detail,
 *  and events queue must all print the same words for the same enum value. */

export const SOURCE_LABELS: Record<string, string> = {
  student_statement: "Student statement",
  teacher_observation: "Teacher referral",
  parent_info: "Parent information",
  ai_flag: "AI flag",
  admin_report: "Admin report",
  content_safety_escalation: "Content safety escalation",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate ids before they reach a ::uuid comparison — malformed input must
 *  404/error cleanly, not throw Postgres 22P02 into a 500. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
