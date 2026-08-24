-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TYPE "core"."activity_type" AS ENUM('tutoring', 'homework', 'quiz', 'revision', 'conversation', 'emotional_checkin', 'game', 'storytelling');--> statement-breakpoint
CREATE TYPE "core"."actor_type" AS ENUM('user', 'ai_agent', 'system');--> statement-breakpoint
CREATE TYPE "core"."ai_access_level" AS ENUM('academic_only', 'academic_general', 'full');--> statement-breakpoint
CREATE TYPE "core"."assessment_rating" AS ENUM('advanced', 'good', 'average', 'needs_support', 'unsure');--> statement-breakpoint
CREATE TYPE "core"."assessor_role" AS ENUM('parent', 'teacher');--> statement-breakpoint
CREATE TYPE "core"."class_teacher_role" AS ENUM('primary', 'support');--> statement-breakpoint
CREATE TYPE "core"."consent_method" AS ENUM('digital', 'paper');--> statement-breakpoint
CREATE TYPE "core"."consent_status" AS ENUM('pending', 'granted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "core"."consent_type" AS ENUM('basic_profile', 'academic_data', 'work_uploads', 'ai_work_analysis', 'ai_interaction', 'conversation_storage', 'teacher_access_ai_summaries', 'health_information', 'development_tracking', 'progress_reports', 'photo_media');--> statement-breakpoint
CREATE TYPE "core"."data_source" AS ENUM('parent', 'teacher', 'student', 'ai');--> statement-breakpoint
CREATE TYPE "core"."evidence_source" AS ENUM('ai_session', 'work_analysis', 'academic_result', 'teacher', 'parent', 'student_statement');--> statement-breakpoint
CREATE TYPE "core"."form_type" AS ENUM('parent_questionnaire', 'teacher_baseline', 'student_interview');--> statement-breakpoint
CREATE TYPE "core"."goal_status" AS ENUM('proposed', 'active', 'improving', 'achieved', 'replaced', 'discontinued');--> statement-breakpoint
CREATE TYPE "core"."goal_type" AS ENUM('academic', 'personal');--> statement-breakpoint
CREATE TYPE "core"."interest_category" AS ENUM('sports', 'tech', 'arts', 'academic', 'other');--> statement-breakpoint
CREATE TYPE "core"."interest_kind" AS ENUM('interest', 'favourite_game', 'favourite_character', 'favourite_topic', 'dislike');--> statement-breakpoint
CREATE TYPE "core"."level_kind" AS ENUM('academic_skill', 'development_area');--> statement-breakpoint
CREATE TYPE "core"."observation_context" AS ENUM('home', 'centre');--> statement-breakpoint
CREATE TYPE "core"."observation_status" AS ENUM('unverified', 'approved', 'partially_approved', 'rejected', 'monitoring');--> statement-breakpoint
CREATE TYPE "core"."report_status" AS ENUM('draft', 'pending_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "core"."result_source" AS ENUM('school', 'centre');--> statement-breakpoint
CREATE TYPE "core"."review_decision" AS ENUM('approved', 'partially_approved', 'rejected', 'monitoring');--> statement-breakpoint
CREATE TYPE "core"."review_status" AS ENUM('pending_review', 'confirmed', 'partial', 'rejected');--> statement-breakpoint
CREATE TYPE "core"."safety_action" AS ENUM('allowed', 'redirected', 'blocked', 'session_ended', 'escalated');--> statement-breakpoint
CREATE TYPE "core"."safety_category" AS ENUM('sexual_content', 'violence', 'self_harm', 'harassment_bullying', 'hate', 'personal_information', 'off_topic_adult', 'prompt_injection', 'disclosure', 'malware', 'nsfw_image', 'unsupported_file');--> statement-breakpoint
CREATE TYPE "core"."safety_surface" AS ENUM('chat_input', 'chat_output', 'file_upload');--> statement-breakpoint
CREATE TYPE "core"."scan_verdict" AS ENUM('clean', 'suspicious', 'rejected', 'pending');--> statement-breakpoint
CREATE TYPE "core"."session_status" AS ENUM('active', 'ended', 'aborted');--> statement-breakpoint
CREATE TYPE "core"."student_status" AS ENUM('active', 'trial', 'temporary', 'inactive');--> statement-breakpoint
CREATE TYPE "core"."student_teacher_role" AS ENUM('form_teacher', 'tutor', 'mentor', 'support');--> statement-breakpoint
CREATE TYPE "core"."supervision_mode" AS ENUM('supervised_centre', 'parent_present', 'unsupervised');--> statement-breakpoint
CREATE TYPE "core"."trait_group" AS ENUM('personality', 'behaviour', 'social', 'communication', 'emotional');--> statement-breakpoint
CREATE TYPE "core"."trait_value_type" AS ENUM('checkbox', 'scale_1_5');--> statement-breakpoint
CREATE TYPE "core"."user_role" AS ENUM('admin', 'teacher', 'guardian', 'student');--> statement-breakpoint
CREATE TYPE "core"."work_source" AS ENUM('school', 'centre', 'home', 'personal');--> statement-breakpoint
CREATE TYPE "core"."work_type" AS ENUM('essay', 'exercise', 'worksheet', 'test', 'exam', 'project', 'drawing', 'presentation', 'reading_record');--> statement-breakpoint
CREATE TABLE "core"."form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"form_type" "core"."form_type" NOT NULL,
	"submitted_by" uuid,
	"payload" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."session_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"messages" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_transcripts_session_id_key" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "core"."traits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(80) NOT NULL,
	"label" varchar(200) NOT NULL,
	"trait_group" "core"."trait_group" NOT NULL,
	"value_type" "core"."trait_value_type" NOT NULL,
	CONSTRAINT "traits_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "core"."work_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_sample_id" uuid NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" varchar(100),
	"findings" jsonb NOT NULL,
	"suggested_next_activity" text,
	"confidence" numeric(4, 3),
	"review_status" "core"."review_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" uuid,
	"reviewer_notes" text
);
--> statement-breakpoint
CREATE TABLE "core"."classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"programme" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(200) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"preferred_contact_method" varchar(50),
	"preferred_language" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardians_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."observation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "core"."review_decision" NOT NULL,
	"comments" text,
	"actions" text[],
	"follow_up_date" date,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."progress_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"period" varchar(50) NOT NULL,
	"content" jsonb,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"generated_by" "core"."data_source" DEFAULT 'teacher' NOT NULL,
	"status" "core"."report_status" DEFAULT 'draft' NOT NULL,
	"draft_content" jsonb,
	"model_version" varchar(100),
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_by_teacher_or_ai" CHECK (generated_by = ANY (ARRAY['teacher'::core.data_source, 'ai'::core.data_source])),
	CONSTRAINT "published_needs_content" CHECK ((status <> 'published'::core.report_status) OR ((content IS NOT NULL) AND (published_by IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "core"."class_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "core"."class_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "core"."class_teacher_role" DEFAULT 'primary' NOT NULL,
	CONSTRAINT "class_teachers_class_id_user_id_key" UNIQUE("class_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"position" varchar(100),
	"is_safeguarding_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"consent_type" "core"."consent_type" NOT NULL,
	"status" "core"."consent_status" NOT NULL,
	"method" "core"."consent_method" DEFAULT 'digital' NOT NULL,
	"granted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" "core"."interest_category" DEFAULT 'other' NOT NULL,
	CONSTRAINT "interests_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "core"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "core"."actor_type" NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"session_id" uuid,
	"work_sample_id" uuid,
	"surface" "core"."safety_surface" NOT NULL,
	"category" "core"."safety_category" NOT NULL,
	"severity" smallint NOT NULL,
	"action_taken" "core"."safety_action" NOT NULL,
	"excerpt" text,
	"classifier" varchar(100),
	"classifier_score" numeric(4, 3),
	"escalated_to_safeguarding" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safety_events_check" CHECK ((session_id IS NOT NULL) OR (work_sample_id IS NOT NULL)),
	CONSTRAINT "safety_events_severity_check" CHECK ((severity >= 1) AND (severity <= 5))
);
--> statement-breakpoint
CREATE TABLE "core"."student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"emergency_priority" smallint,
	CONSTRAINT "student_guardians_student_id_guardian_id_key" UNIQUE("guardian_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "core"."student_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "core"."student_teacher_role" DEFAULT 'tutor' NOT NULL,
	"subject_id" uuid,
	"start_date" date DEFAULT CURRENT_DATE NOT NULL,
	"end_date" date,
	CONSTRAINT "student_teachers_student_id_user_id_role_key" UNIQUE("role","student_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."upload_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_sample_id" uuid NOT NULL,
	"verdict" "core"."scan_verdict" DEFAULT 'pending' NOT NULL,
	"mime_detected" varchar(100),
	"size_bytes" bigint,
	"malware_scan" varchar(100),
	"image_scan" varchar(100),
	"details" jsonb,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"auth_identity" varchar(255),
	"role" "core"."user_role" NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(50),
	"preferred_language" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" varchar(60),
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_username_key" UNIQUE("username"),
	CONSTRAINT "users_has_identifier" CHECK ((email IS NOT NULL) OR (username IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "core"."student_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "core"."level_kind" NOT NULL,
	"key" varchar(80) NOT NULL,
	"subject_id" uuid,
	"score" smallint NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"set_by_observation_id" uuid,
	"set_by_user_id" uuid,
	CONSTRAINT "student_levels_check" CHECK (num_nonnulls(set_by_observation_id, set_by_user_id) = 1),
	CONSTRAINT "student_levels_score_check" CHECK ((score >= 1) AND (score <= 5))
);
--> statement-breakpoint
CREATE TABLE "core"."ai_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"started_by" uuid NOT NULL,
	"device_id" varchar(100),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "core"."session_status" DEFAULT 'active' NOT NULL,
	"started_by_role" "core"."user_role" DEFAULT 'teacher' NOT NULL,
	"supervision_mode" "core"."supervision_mode" DEFAULT 'supervised_centre' NOT NULL,
	"ended_reason" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "core"."students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_code" varchar(50) NOT NULL,
	"branch_id" uuid NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"preferred_name" varchar(100),
	"dob" date NOT NULL,
	"gender" varchar(20),
	"status" "core"."student_status" DEFAULT 'active' NOT NULL,
	"programme" varchar(100),
	"school_name" varchar(200),
	"school_type" varchar(100),
	"curriculum" varchar(100),
	"school_grade" varchar(50),
	"main_school_language" varchar(50),
	"primary_home_language" varchar(50),
	"preferred_ai_language" varchar(50),
	"ai_access_level" "core"."ai_access_level" DEFAULT 'academic_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"unsupervised_access_enabled" boolean DEFAULT false NOT NULL,
	"max_session_minutes" smallint DEFAULT 45,
	"allowed_hours_start" time,
	"allowed_hours_end" time,
	CONSTRAINT "students_student_code_key" UNIQUE("student_code"),
	CONSTRAINT "students_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "subjects_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "core"."student_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "student_subjects_student_id_subject_id_key" UNIQUE("student_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "core"."student_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"interest_id" uuid,
	"kind" "core"."interest_kind" DEFAULT 'interest' NOT NULL,
	"free_text" varchar(200),
	"source" "core"."data_source" NOT NULL,
	"noted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_interests_check" CHECK ((interest_id IS NOT NULL) OR (free_text IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "core"."trait_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"trait_id" uuid NOT NULL,
	"value" varchar(50) NOT NULL,
	"source" "core"."data_source" NOT NULL,
	"context" "core"."observation_context",
	"form_submission_id" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."academic_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"assessor_role" "core"."assessor_role" NOT NULL,
	"assessor_id" uuid,
	"rating" "core"."assessment_rating" NOT NULL,
	"notes" text,
	"form_submission_id" uuid,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."academic_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"assessment_type" varchar(100) NOT NULL,
	"assessment_date" date NOT NULL,
	"school_year" varchar(20),
	"term" varchar(20),
	"score" numeric(6, 2),
	"max_score" numeric(6, 2),
	"grade" varchar(10),
	"class_position" integer,
	"teacher_comment" text,
	"source" "core"."result_source",
	"entered_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."work_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid,
	"work_type" "core"."work_type" NOT NULL,
	"title_topic" varchar(300),
	"work_date" date,
	"school_year" varchar(20),
	"source" "core"."work_source" NOT NULL,
	"submitted_by" uuid,
	"file_url" text NOT NULL,
	"file_type" varchar(50),
	"teacher_score" numeric(6, 2),
	"max_score" numeric(6, 2),
	"teacher_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scan_status" "core"."scan_verdict" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."goal_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"note" text,
	"progress" smallint,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."session_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"activity_type" "core"."activity_type" NOT NULL,
	"subject_id" uuid,
	"topic" varchar(200),
	"difficulty" varchar(50),
	"attempted" integer,
	"correct" integer,
	"incorrect" integer,
	"hints_used" integer,
	"engagement_level" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_activities_engagement_level_check" CHECK ((engagement_level >= 1) AND (engagement_level <= 5))
);
--> statement-breakpoint
CREATE TABLE "core"."observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"statement" text NOT NULL,
	"evidence_source" "core"."evidence_source" NOT NULL,
	"evidence_ref" uuid,
	"confidence" numeric(4, 3),
	"source_role" "core"."data_source" NOT NULL,
	"proposed_change" jsonb,
	"status" "core"."observation_status" DEFAULT 'unverified' NOT NULL,
	"synthesis_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "core"."goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"goal_type" "core"."goal_type" NOT NULL,
	"subject_id" uuid,
	"title" varchar(300) NOT NULL,
	"description" text,
	"requested_by_role" "core"."data_source" NOT NULL,
	"requested_by_user" uuid,
	"status" "core"."goal_status" DEFAULT 'proposed' NOT NULL,
	"start_date" date,
	"target_date" date,
	"review_date" date
);
--> statement-breakpoint
ALTER TABLE "core"."form_submissions" ADD CONSTRAINT "form_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."session_transcripts" ADD CONSTRAINT "session_transcripts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "core"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."work_analyses" ADD CONSTRAINT "work_analyses_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."work_analyses" ADD CONSTRAINT "work_analyses_work_sample_id_fkey" FOREIGN KEY ("work_sample_id") REFERENCES "core"."work_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."classes" ADD CONSTRAINT "classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "core"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."guardians" ADD CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."observation_reviews" ADD CONSTRAINT "observation_reviews_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "core"."observations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."observation_reviews" ADD CONSTRAINT "observation_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."progress_reports" ADD CONSTRAINT "progress_reports_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."progress_reports" ADD CONSTRAINT "progress_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."progress_reports" ADD CONSTRAINT "progress_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "core"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."class_enrollments" ADD CONSTRAINT "class_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."class_teachers" ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "core"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."class_teachers" ADD CONSTRAINT "class_teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_profiles" ADD CONSTRAINT "staff_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "core"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."consents" ADD CONSTRAINT "consents_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "core"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."consents" ADD CONSTRAINT "consents_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."consents" ADD CONSTRAINT "consents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."audit_log" ADD CONSTRAINT "audit_log_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."safety_events" ADD CONSTRAINT "safety_events_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."safety_events" ADD CONSTRAINT "safety_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "core"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."safety_events" ADD CONSTRAINT "safety_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."safety_events" ADD CONSTRAINT "safety_events_work_sample_id_fkey" FOREIGN KEY ("work_sample_id") REFERENCES "core"."work_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_guardians" ADD CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "core"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_guardians" ADD CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_teachers" ADD CONSTRAINT "student_teachers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_teachers" ADD CONSTRAINT "student_teachers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_teachers" ADD CONSTRAINT "student_teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."upload_scans" ADD CONSTRAINT "upload_scans_work_sample_id_fkey" FOREIGN KEY ("work_sample_id") REFERENCES "core"."work_samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_levels" ADD CONSTRAINT "student_levels_set_by_observation_id_fkey" FOREIGN KEY ("set_by_observation_id") REFERENCES "core"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_levels" ADD CONSTRAINT "student_levels_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_levels" ADD CONSTRAINT "student_levels_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_levels" ADD CONSTRAINT "student_levels_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."ai_sessions" ADD CONSTRAINT "ai_sessions_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."ai_sessions" ADD CONSTRAINT "ai_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."students" ADD CONSTRAINT "students_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "core"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_subjects" ADD CONSTRAINT "student_subjects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_subjects" ADD CONSTRAINT "student_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_interests" ADD CONSTRAINT "student_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "core"."interests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."student_interests" ADD CONSTRAINT "student_interests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."trait_observations" ADD CONSTRAINT "trait_observations_form_submission_id_fkey" FOREIGN KEY ("form_submission_id") REFERENCES "core"."form_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."trait_observations" ADD CONSTRAINT "trait_observations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."trait_observations" ADD CONSTRAINT "trait_observations_trait_id_fkey" FOREIGN KEY ("trait_id") REFERENCES "core"."traits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_assessments" ADD CONSTRAINT "academic_assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_assessments" ADD CONSTRAINT "academic_assessments_form_submission_id_fkey" FOREIGN KEY ("form_submission_id") REFERENCES "core"."form_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_assessments" ADD CONSTRAINT "academic_assessments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_assessments" ADD CONSTRAINT "academic_assessments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_results" ADD CONSTRAINT "academic_results_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_results" ADD CONSTRAINT "academic_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."academic_results" ADD CONSTRAINT "academic_results_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."work_samples" ADD CONSTRAINT "work_samples_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."work_samples" ADD CONSTRAINT "work_samples_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."work_samples" ADD CONSTRAINT "work_samples_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."goal_updates" ADD CONSTRAINT "goal_updates_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "core"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."goal_updates" ADD CONSTRAINT "goal_updates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."session_activities" ADD CONSTRAINT "session_activities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "core"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."session_activities" ADD CONSTRAINT "session_activities_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."observations" ADD CONSTRAINT "observations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."goals" ADD CONSTRAINT "goals_requested_by_user_fkey" FOREIGN KEY ("requested_by_user") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."goals" ADD CONSTRAINT "goals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "core"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."goals" ADD CONSTRAINT "goals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "core"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_form_submissions_student" ON "core"."form_submissions" USING btree ("student_id" enum_ops,"form_type" enum_ops,"submitted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_work_analyses_pending" ON "core"."work_analyses" USING btree ("review_status" timestamptz_ops,"analyzed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_progress_reports_queue" ON "core"."progress_reports" USING btree ("status" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_class_enrollments_class" ON "core"."class_enrollments" USING btree ("class_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_class_enrollments_student" ON "core"."class_enrollments" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_consents_current" ON "core"."consents" USING btree ("student_id" enum_ops,"consent_type" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "core"."audit_log" USING btree ("actor_type" timestamptz_ops,"at" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "core"."audit_log" USING btree ("entity_type" uuid_ops,"entity_id" uuid_ops,"at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_safety_events_review" ON "core"."safety_events" USING btree ("severity" int2_ops,"reviewed_at" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_safety_events_session" ON "core"."safety_events" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_safety_events_student" ON "core"."safety_events" USING btree ("student_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_student_teachers_student" ON "core"."student_teachers" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_student_teachers_user" ON "core"."student_teachers" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_upload_scans_sample" ON "core"."upload_scans" USING btree ("work_sample_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_student_levels_history" ON "core"."student_levels" USING btree ("student_id" text_ops,"kind" text_ops,"key" text_ops,"effective_from" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_sessions_student" ON "core"."ai_sessions" USING btree ("student_id" timestamptz_ops,"started_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_student_interests_student" ON "core"."student_interests" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_trait_observations_student" ON "core"."trait_observations" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_academic_assessments_student" ON "core"."academic_assessments" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_academic_results_student" ON "core"."academic_results" USING btree ("student_id" date_ops,"subject_id" uuid_ops,"assessment_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_work_samples_student" ON "core"."work_samples" USING btree ("student_id" date_ops,"work_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_session_activities_session" ON "core"."session_activities" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_observations_queue" ON "core"."observations" USING btree ("status" enum_ops,"created_at" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_observations_student" ON "core"."observations" USING btree ("student_id" uuid_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_goals_student" ON "core"."goals" USING btree ("student_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE VIEW "core"."v_student_access" AS (SELECT ct.user_id, e.student_id, 'class'::text AS via FROM core.class_teachers ct JOIN core.class_enrollments e ON e.class_id = ct.class_id WHERE e.end_date IS NULL OR e.end_date >= CURRENT_DATE UNION SELECT st.user_id, st.student_id, 'direct'::text AS via FROM core.student_teachers st WHERE st.end_date IS NULL OR st.end_date >= CURRENT_DATE);--> statement-breakpoint
CREATE VIEW "core"."v_student_current_classes" AS (SELECT e.student_id, c.id AS class_id, c.name AS class_name, c.programme, c.branch_id, e.start_date FROM core.class_enrollments e JOIN core.classes c ON c.id = e.class_id WHERE e.end_date IS NULL OR e.end_date >= CURRENT_DATE);--> statement-breakpoint
CREATE VIEW "core"."v_current_levels" AS (SELECT DISTINCT ON (student_id, kind, key) student_id, kind, key, subject_id, score, effective_from, set_by_observation_id, set_by_user_id FROM core.student_levels ORDER BY student_id, kind, key, effective_from DESC);--> statement-breakpoint
CREATE VIEW "core"."v_current_consents" AS (SELECT DISTINCT ON (student_id, consent_type) student_id, consent_type, status, method, granted_at, withdrawn_at, created_at FROM core.consents ORDER BY student_id, consent_type, created_at DESC);
*/