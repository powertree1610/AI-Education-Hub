import type { ConsentType } from "@platform/shared";

/** Parent-facing wording for each consent category (M2). */
export const CONSENT_LABELS: Record<ConsentType, string> = {
  basic_profile: "Store basic profile & registration data",
  academic_data: "Store school results and assessments",
  work_uploads: "Upload and store work samples",
  ai_work_analysis: "Let the AI analyse uploaded work",
  ai_interaction: "Let the student use the AI tutor (supervised)",
  conversation_storage: "Store AI conversation transcripts",
  teacher_access_ai_summaries: "Teachers may view AI session summaries",
  health_information: "Store health information (allergies, medication)",
  development_tracking: "Track development areas and goals over time",
  progress_reports: "Receive periodic progress reports",
  photo_media: "Store photos / media of the student's work",
};
