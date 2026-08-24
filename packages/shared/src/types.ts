/** Shapes shared across web + mcp-server. Kept aligned with the worked example. */

/** observations.proposed_change — stored, never applied until teacher approval. */
export interface ProposedChange {
  target: "student_levels" | "student_interests" | "goals";
  key?: string;
  subject_id?: string | null;
  from?: unknown;
  to?: unknown;
}

/** work_analyses.findings JSONB. */
export interface WorkAnalysisFindings {
  strengths: string[];
  improvements: string[];
  recurring_mistakes: string[];
  skills_shown: string[];
}

/** session_transcripts.messages JSONB entries (worked-example format). */
export interface TranscriptMessage {
  role: "assistant" | "student";
  text: string;
}
