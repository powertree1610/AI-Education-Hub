import { pgTable, pgSchema, index, foreignKey, uuid, jsonb, integer, timestamp, unique, varchar, text, numeric, boolean, date, check, smallint, bigint, time } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { customType } from "drizzle-orm/pg-core"

// MANUAL FIX after drizzle-kit pull: citext is not parsed by introspection.
// Re-apply this block if the schema is ever re-pulled.
const citext = customType<{ data: string }>({ dataType: () => "citext" });

export const core = pgSchema("core");
export const activityTypeInCore = core.enum("activity_type", ['tutoring', 'homework', 'quiz', 'revision', 'conversation', 'emotional_checkin', 'game', 'storytelling'])
export const actorTypeInCore = core.enum("actor_type", ['user', 'ai_agent', 'system'])
export const aiAccessLevelInCore = core.enum("ai_access_level", ['academic_only', 'academic_general', 'full'])
export const assessmentRatingInCore = core.enum("assessment_rating", ['advanced', 'good', 'average', 'needs_support', 'unsure'])
export const assessorRoleInCore = core.enum("assessor_role", ['parent', 'teacher'])
export const classTeacherRoleInCore = core.enum("class_teacher_role", ['primary', 'support'])
export const consentMethodInCore = core.enum("consent_method", ['digital', 'paper'])
export const consentStatusInCore = core.enum("consent_status", ['pending', 'granted', 'withdrawn'])
export const consentTypeInCore = core.enum("consent_type", ['basic_profile', 'academic_data', 'work_uploads', 'ai_work_analysis', 'ai_interaction', 'conversation_storage', 'teacher_access_ai_summaries', 'health_information', 'development_tracking', 'progress_reports', 'photo_media'])
export const dataSourceInCore = core.enum("data_source", ['parent', 'teacher', 'student', 'ai'])
export const evidenceSourceInCore = core.enum("evidence_source", ['ai_session', 'work_analysis', 'academic_result', 'teacher', 'parent', 'student_statement'])
export const formTypeInCore = core.enum("form_type", ['parent_questionnaire', 'teacher_baseline', 'student_interview'])
export const goalStatusInCore = core.enum("goal_status", ['proposed', 'active', 'improving', 'achieved', 'replaced', 'discontinued'])
export const goalTypeInCore = core.enum("goal_type", ['academic', 'personal'])
export const interestCategoryInCore = core.enum("interest_category", ['sports', 'tech', 'arts', 'academic', 'other'])
export const interestKindInCore = core.enum("interest_kind", ['interest', 'favourite_game', 'favourite_character', 'favourite_topic', 'dislike'])
export const levelKindInCore = core.enum("level_kind", ['academic_skill', 'development_area'])
export const observationContextInCore = core.enum("observation_context", ['home', 'centre'])
export const observationStatusInCore = core.enum("observation_status", ['unverified', 'approved', 'partially_approved', 'rejected', 'monitoring'])
export const reportStatusInCore = core.enum("report_status", ['draft', 'pending_review', 'published', 'archived'])
export const resultSourceInCore = core.enum("result_source", ['school', 'centre'])
export const reviewDecisionInCore = core.enum("review_decision", ['approved', 'partially_approved', 'rejected', 'monitoring'])
export const reviewStatusInCore = core.enum("review_status", ['pending_review', 'confirmed', 'partial', 'rejected'])
export const safetyActionInCore = core.enum("safety_action", ['allowed', 'redirected', 'blocked', 'session_ended', 'escalated'])
export const safetyCategoryInCore = core.enum("safety_category", ['sexual_content', 'violence', 'self_harm', 'harassment_bullying', 'hate', 'personal_information', 'off_topic_adult', 'prompt_injection', 'disclosure', 'malware', 'nsfw_image', 'unsupported_file'])
export const safetySurfaceInCore = core.enum("safety_surface", ['chat_input', 'chat_output', 'file_upload'])
export const scanVerdictInCore = core.enum("scan_verdict", ['clean', 'suspicious', 'rejected', 'pending'])
export const sessionStatusInCore = core.enum("session_status", ['active', 'ended', 'aborted'])
export const studentStatusInCore = core.enum("student_status", ['active', 'trial', 'temporary', 'inactive'])
export const studentTeacherRoleInCore = core.enum("student_teacher_role", ['form_teacher', 'tutor', 'mentor', 'support'])
export const supervisionModeInCore = core.enum("supervision_mode", ['supervised_centre', 'parent_present', 'unsupervised'])
// MANUAL FIX (v5, migration 0006): re-add after any drizzle-kit pull.
export const sessionKindInCore = core.enum("session_kind", ['academic', 'daily'])
export const assistModeInCore = core.enum("assist_mode", ['learning', 'practice', 'assessment'])
export const traitGroupInCore = core.enum("trait_group", ['personality', 'behaviour', 'social', 'communication', 'emotional'])
export const traitValueTypeInCore = core.enum("trait_value_type", ['checkbox', 'scale_1_5'])
export const userRoleInCore = core.enum("user_role", ['admin', 'teacher', 'guardian', 'student'])
export const workSourceInCore = core.enum("work_source", ['school', 'centre', 'home', 'personal'])
export const workTypeInCore = core.enum("work_type", ['essay', 'exercise', 'worksheet', 'test', 'exam', 'project', 'drawing', 'presentation', 'reading_record'])


export const formSubmissionsInCore = core.table("form_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	formType: formTypeInCore("form_type").notNull(),
	submittedBy: uuid("submitted_by"),
	payload: jsonb().notNull(),
	schemaVersion: integer("schema_version").default(1).notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_form_submissions_student").using("btree", table.studentId.asc().nullsLast().op("enum_ops"), table.formType.asc().nullsLast().op("enum_ops"), table.submittedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "form_submissions_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [usersInCore.id],
			name: "form_submissions_submitted_by_fkey"
		}),
]);

export const sessionTranscriptsInCore = core.table("session_transcripts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	messages: jsonb().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [aiSessionsInCore.id],
			name: "session_transcripts_session_id_fkey"
		}).onDelete("cascade"),
	unique("session_transcripts_session_id_key").on(table.sessionId),
]);

export const traitsInCore = core.table("traits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	key: varchar({ length: 80 }).notNull(),
	label: varchar({ length: 200 }).notNull(),
	traitGroup: traitGroupInCore("trait_group").notNull(),
	valueType: traitValueTypeInCore("value_type").notNull(),
}, (table) => [
	unique("traits_key_key").on(table.key),
]);

export const workAnalysesInCore = core.table("work_analyses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workSampleId: uuid("work_sample_id").notNull(),
	analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modelVersion: varchar("model_version", { length: 100 }),
	findings: jsonb().notNull(),
	suggestedNextActivity: text("suggested_next_activity"),
	confidence: numeric({ precision: 4, scale:  3 }),
	reviewStatus: reviewStatusInCore("review_status").default('pending_review').notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewerNotes: text("reviewer_notes"),
}, (table) => [
	index("idx_work_analyses_pending").using("btree", table.reviewStatus.asc().nullsLast().op("timestamptz_ops"), table.analyzedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [usersInCore.id],
			name: "work_analyses_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.workSampleId],
			foreignColumns: [workSamplesInCore.id],
			name: "work_analyses_work_sample_id_fkey"
		}).onDelete("cascade"),
]);

export const classesInCore = core.table("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	branchId: uuid("branch_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	programme: varchar({ length: 100 }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branchesInCore.id],
			name: "classes_branch_id_fkey"
		}),
]);

export const guardiansInCore = core.table("guardians", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	name: varchar({ length: 200 }).notNull(),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	preferredContactMethod: varchar("preferred_contact_method", { length: 50 }),
	preferredLanguage: varchar("preferred_language", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInCore.id],
			name: "guardians_user_id_fkey"
		}).onDelete("set null"),
	unique("guardians_user_id_key").on(table.userId),
]);

export const observationReviewsInCore = core.table("observation_reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	observationId: uuid("observation_id").notNull(),
	reviewerId: uuid("reviewer_id").notNull(),
	decision: reviewDecisionInCore().notNull(),
	comments: text(),
	actions: text().array(),
	followUpDate: date("follow_up_date"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.observationId],
			foreignColumns: [observationsInCore.id],
			name: "observation_reviews_observation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewerId],
			foreignColumns: [usersInCore.id],
			name: "observation_reviews_reviewer_id_fkey"
		}),
]);

export const progressReportsInCore = core.table("progress_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	period: varchar({ length: 50 }).notNull(),
	content: jsonb(),
	publishedBy: uuid("published_by"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	generatedBy: dataSourceInCore("generated_by").default('teacher').notNull(),
	status: reportStatusInCore().default('draft').notNull(),
	draftContent: jsonb("draft_content"),
	modelVersion: varchar("model_version", { length: 100 }),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_progress_reports_queue").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.publishedBy],
			foreignColumns: [usersInCore.id],
			name: "progress_reports_published_by_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [usersInCore.id],
			name: "progress_reports_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "progress_reports_student_id_fkey"
		}).onDelete("cascade"),
	check("generated_by_teacher_or_ai", sql`generated_by = ANY (ARRAY['teacher'::core.data_source, 'ai'::core.data_source])`),
	check("published_needs_content", sql`(status <> 'published'::core.report_status) OR ((content IS NOT NULL) AND (published_by IS NOT NULL))`),
]);

export const classEnrollmentsInCore = core.table("class_enrollments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	classId: uuid("class_id").notNull(),
	studentId: uuid("student_id").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
}, (table) => [
	index("idx_class_enrollments_class").using("btree", table.classId.asc().nullsLast().op("uuid_ops")),
	index("idx_class_enrollments_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classesInCore.id],
			name: "class_enrollments_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "class_enrollments_student_id_fkey"
		}).onDelete("cascade"),
]);

export const classTeachersInCore = core.table("class_teachers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	classId: uuid("class_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: classTeacherRoleInCore().default('primary').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classesInCore.id],
			name: "class_teachers_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInCore.id],
			name: "class_teachers_user_id_fkey"
		}).onDelete("cascade"),
	unique("class_teachers_class_id_user_id_key").on(table.classId, table.userId),
]);

export const branchesInCore = core.table("branches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	address: text(),
	phone: varchar({ length: 50 }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const staffProfilesInCore = core.table("staff_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	branchId: uuid("branch_id").notNull(),
	position: varchar({ length: 100 }),
	isSafeguardingLead: boolean("is_safeguarding_lead").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branchesInCore.id],
			name: "staff_profiles_branch_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInCore.id],
			name: "staff_profiles_user_id_fkey"
		}).onDelete("cascade"),
	unique("staff_profiles_user_id_key").on(table.userId),
]);

export const consentsInCore = core.table("consents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	guardianId: uuid("guardian_id").notNull(),
	consentType: consentTypeInCore("consent_type").notNull(),
	status: consentStatusInCore().notNull(),
	method: consentMethodInCore().default('digital').notNull(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }),
	withdrawnAt: timestamp("withdrawn_at", { withTimezone: true, mode: 'string' }),
	recordedBy: uuid("recorded_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_consents_current").using("btree", table.studentId.asc().nullsLast().op("enum_ops"), table.consentType.asc().nullsLast().op("enum_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.guardianId],
			foreignColumns: [guardiansInCore.id],
			name: "consents_guardian_id_fkey"
		}),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [usersInCore.id],
			name: "consents_recorded_by_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "consents_student_id_fkey"
		}).onDelete("cascade"),
]);

export const interestsInCore = core.table("interests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	category: interestCategoryInCore().default('other').notNull(),
}, (table) => [
	unique("interests_name_key").on(table.name),
]);

export const auditLogInCore = core.table("audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorType: actorTypeInCore("actor_type").notNull(),
	actorId: uuid("actor_id"),
	action: varchar({ length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 100 }).notNull(),
	entityId: uuid("entity_id"),
	details: jsonb(),
	at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_actor").using("btree", table.actorType.asc().nullsLast().op("timestamptz_ops"), table.at.desc().nullsFirst().op("enum_ops")),
	index("idx_audit_entity").using("btree", table.entityType.asc().nullsLast().op("uuid_ops"), table.entityId.asc().nullsLast().op("uuid_ops"), table.at.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [usersInCore.id],
			name: "audit_log_actor_fk"
		}).onDelete("restrict"),
]);

export const safetyEventsInCore = core.table("safety_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	sessionId: uuid("session_id"),
	workSampleId: uuid("work_sample_id"),
	surface: safetySurfaceInCore().notNull(),
	category: safetyCategoryInCore().notNull(),
	severity: smallint().notNull(),
	actionTaken: safetyActionInCore("action_taken").notNull(),
	excerpt: text(),
	classifier: varchar({ length: 100 }),
	classifierScore: numeric("classifier_score", { precision: 4, scale:  3 }),
	escalatedToSafeguarding: boolean("escalated_to_safeguarding").default(false).notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_safety_events_review").using("btree", table.severity.desc().nullsFirst().op("int2_ops"), table.reviewedAt.asc().nullsFirst().op("int2_ops")),
	index("idx_safety_events_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_safety_events_student").using("btree", table.studentId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [usersInCore.id],
			name: "safety_events_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [aiSessionsInCore.id],
			name: "safety_events_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "safety_events_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workSampleId],
			foreignColumns: [workSamplesInCore.id],
			name: "safety_events_work_sample_id_fkey"
		}).onDelete("cascade"),
	check("safety_events_check", sql`(session_id IS NOT NULL) OR (work_sample_id IS NOT NULL)`),
	check("safety_events_severity_check", sql`(severity >= 1) AND (severity <= 5)`),
]);

export const studentGuardiansInCore = core.table("student_guardians", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	guardianId: uuid("guardian_id").notNull(),
	relationship: varchar({ length: 50 }).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	isEmergencyContact: boolean("is_emergency_contact").default(false).notNull(),
	emergencyPriority: smallint("emergency_priority"),
}, (table) => [
	foreignKey({
			columns: [table.guardianId],
			foreignColumns: [guardiansInCore.id],
			name: "student_guardians_guardian_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "student_guardians_student_id_fkey"
		}).onDelete("cascade"),
	unique("student_guardians_student_id_guardian_id_key").on(table.guardianId, table.studentId),
]);

export const studentTeachersInCore = core.table("student_teachers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: studentTeacherRoleInCore().default('tutor').notNull(),
	subjectId: uuid("subject_id"),
	startDate: date("start_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
}, (table) => [
	index("idx_student_teachers_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	index("idx_student_teachers_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "student_teachers_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "student_teachers_subject_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInCore.id],
			name: "student_teachers_user_id_fkey"
		}).onDelete("cascade"),
	unique("student_teachers_student_id_user_id_role_key").on(table.role, table.studentId, table.userId),
]);

export const uploadScansInCore = core.table("upload_scans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workSampleId: uuid("work_sample_id").notNull(),
	verdict: scanVerdictInCore().default('pending').notNull(),
	mimeDetected: varchar("mime_detected", { length: 100 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sizeBytes: bigint("size_bytes", { mode: "number" }),
	malwareScan: varchar("malware_scan", { length: 100 }),
	imageScan: varchar("image_scan", { length: 100 }),
	details: jsonb(),
	scannedAt: timestamp("scanned_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_upload_scans_sample").using("btree", table.workSampleId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.workSampleId],
			foreignColumns: [workSamplesInCore.id],
			name: "upload_scans_work_sample_id_fkey"
		}).onDelete("cascade"),
]);

export const usersInCore = core.table("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: citext("email"),
	authIdentity: varchar("auth_identity", { length: 255 }),
	// MANUAL FIX after drizzle-kit pull: added by migrations/0003_password_hash.sql.
	passwordHash: varchar("password_hash", { length: 100 }),
	role: userRoleInCore().notNull(),
	name: varchar({ length: 200 }).notNull(),
	phone: varchar({ length: 50 }),
	preferredLanguage: varchar("preferred_language", { length: 50 }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	username: varchar({ length: 60 }),
}, (table) => [
	unique("users_email_key").on(table.email),
	unique("users_username_key").on(table.username),
	check("users_has_identifier", sql`(email IS NOT NULL) OR (username IS NOT NULL)`),
]);

export const studentLevelsInCore = core.table("student_levels", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	kind: levelKindInCore().notNull(),
	key: varchar({ length: 80 }).notNull(),
	subjectId: uuid("subject_id"),
	score: smallint().notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	setByObservationId: uuid("set_by_observation_id"),
	setByUserId: uuid("set_by_user_id"),
}, (table) => [
	index("idx_student_levels_history").using("btree", table.studentId.asc().nullsLast().op("text_ops"), table.kind.asc().nullsLast().op("text_ops"), table.key.asc().nullsLast().op("text_ops"), table.effectiveFrom.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.setByObservationId],
			foreignColumns: [observationsInCore.id],
			name: "student_levels_set_by_observation_id_fkey"
		}),
	foreignKey({
			columns: [table.setByUserId],
			foreignColumns: [usersInCore.id],
			name: "student_levels_set_by_user_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "student_levels_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "student_levels_subject_id_fkey"
		}),
	check("student_levels_check", sql`num_nonnulls(set_by_observation_id, set_by_user_id) = 1`),
	check("student_levels_score_check", sql`(score >= 1) AND (score <= 5)`),
]);

export const aiSessionsInCore = core.table("ai_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	startedBy: uuid("started_by").notNull(),
	deviceId: varchar("device_id", { length: 100 }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	status: sessionStatusInCore().default('active').notNull(),
	startedByRole: userRoleInCore("started_by_role").default('teacher').notNull(),
	supervisionMode: supervisionModeInCore("supervision_mode").default('supervised_centre').notNull(),
	endedReason: varchar("ended_reason", { length: 50 }),
	// MANUAL FIX (v5, migration 0006): re-add after any drizzle-kit pull.
	sessionKind: sessionKindInCore("session_kind").default('academic').notNull(),
	assistMode: assistModeInCore("assist_mode").default('learning').notNull(),
}, (table) => [
	index("idx_ai_sessions_student").using("btree", table.studentId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.startedBy],
			foreignColumns: [usersInCore.id],
			name: "ai_sessions_started_by_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "ai_sessions_student_id_fkey"
		}).onDelete("cascade"),
]);

export const studentsInCore = core.table("students", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentCode: varchar("student_code", { length: 50 }).notNull(),
	branchId: uuid("branch_id").notNull(),
	fullName: varchar("full_name", { length: 200 }).notNull(),
	preferredName: varchar("preferred_name", { length: 100 }),
	dob: date().notNull(),
	gender: varchar({ length: 20 }),
	status: studentStatusInCore().default('active').notNull(),
	programme: varchar({ length: 100 }),
	schoolName: varchar("school_name", { length: 200 }),
	schoolType: varchar("school_type", { length: 100 }),
	curriculum: varchar({ length: 100 }),
	schoolGrade: varchar("school_grade", { length: 50 }),
	mainSchoolLanguage: varchar("main_school_language", { length: 50 }),
	primaryHomeLanguage: varchar("primary_home_language", { length: 50 }),
	preferredAiLanguage: varchar("preferred_ai_language", { length: 50 }),
	aiAccessLevel: aiAccessLevelInCore("ai_access_level").default('academic_only').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id"),
	unsupervisedAccessEnabled: boolean("unsupervised_access_enabled").default(false).notNull(),
	maxSessionMinutes: smallint("max_session_minutes").default(45),
	allowedHoursStart: time("allowed_hours_start"),
	allowedHoursEnd: time("allowed_hours_end"),
	// MANUAL FIX (v5, migrations 0005/0006): re-add after any drizzle-kit pull.
	schoolId: uuid("school_id"),
	defaultAssistMode: assistModeInCore("default_assist_mode").default('learning').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branchesInCore.id],
			name: "students_branch_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInCore.id],
			name: "students_user_id_fkey"
		}).onDelete("set null"),
	unique("students_student_code_key").on(table.studentCode),
	unique("students_user_id_key").on(table.userId),
]);

export const subjectsInCore = core.table("subjects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 30 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
}, (table) => [
	unique("subjects_code_key").on(table.code),
]);

export const studentSubjectsInCore = core.table("student_subjects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "student_subjects_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "student_subjects_subject_id_fkey"
		}),
	unique("student_subjects_student_id_subject_id_key").on(table.studentId, table.subjectId),
]);

export const studentInterestsInCore = core.table("student_interests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	interestId: uuid("interest_id"),
	kind: interestKindInCore().default('interest').notNull(),
	freeText: varchar("free_text", { length: 200 }),
	source: dataSourceInCore().notNull(),
	notedAt: timestamp("noted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_student_interests_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.interestId],
			foreignColumns: [interestsInCore.id],
			name: "student_interests_interest_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "student_interests_student_id_fkey"
		}).onDelete("cascade"),
	check("student_interests_check", sql`(interest_id IS NOT NULL) OR (free_text IS NOT NULL)`),
]);

export const traitObservationsInCore = core.table("trait_observations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	traitId: uuid("trait_id").notNull(),
	value: varchar({ length: 50 }).notNull(),
	source: dataSourceInCore().notNull(),
	context: observationContextInCore(),
	formSubmissionId: uuid("form_submission_id"),
	observedAt: timestamp("observed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_trait_observations_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.formSubmissionId],
			foreignColumns: [formSubmissionsInCore.id],
			name: "trait_observations_form_submission_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "trait_observations_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.traitId],
			foreignColumns: [traitsInCore.id],
			name: "trait_observations_trait_id_fkey"
		}),
]);

export const academicAssessmentsInCore = core.table("academic_assessments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
	assessorRole: assessorRoleInCore("assessor_role").notNull(),
	assessorId: uuid("assessor_id"),
	rating: assessmentRatingInCore().notNull(),
	notes: text(),
	formSubmissionId: uuid("form_submission_id"),
	assessedAt: timestamp("assessed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_academic_assessments_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.assessorId],
			foreignColumns: [usersInCore.id],
			name: "academic_assessments_assessor_id_fkey"
		}),
	foreignKey({
			columns: [table.formSubmissionId],
			foreignColumns: [formSubmissionsInCore.id],
			name: "academic_assessments_form_submission_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "academic_assessments_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "academic_assessments_subject_id_fkey"
		}),
]);

export const academicResultsInCore = core.table("academic_results", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
	assessmentType: varchar("assessment_type", { length: 100 }).notNull(),
	assessmentDate: date("assessment_date").notNull(),
	schoolYear: varchar("school_year", { length: 20 }),
	term: varchar({ length: 20 }),
	score: numeric({ precision: 6, scale:  2 }),
	maxScore: numeric("max_score", { precision: 6, scale:  2 }),
	grade: varchar({ length: 10 }),
	classPosition: integer("class_position"),
	teacherComment: text("teacher_comment"),
	source: resultSourceInCore(),
	enteredBy: uuid("entered_by"),
}, (table) => [
	index("idx_academic_results_student").using("btree", table.studentId.asc().nullsLast().op("date_ops"), table.subjectId.asc().nullsLast().op("uuid_ops"), table.assessmentDate.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.enteredBy],
			foreignColumns: [usersInCore.id],
			name: "academic_results_entered_by_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "academic_results_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "academic_results_subject_id_fkey"
		}),
]);

export const workSamplesInCore = core.table("work_samples", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	subjectId: uuid("subject_id"),
	workType: workTypeInCore("work_type").notNull(),
	titleTopic: varchar("title_topic", { length: 300 }),
	workDate: date("work_date"),
	schoolYear: varchar("school_year", { length: 20 }),
	source: workSourceInCore().notNull(),
	submittedBy: uuid("submitted_by"),
	fileUrl: text("file_url").notNull(),
	fileType: varchar("file_type", { length: 50 }),
	teacherScore: numeric("teacher_score", { precision: 6, scale:  2 }),
	maxScore: numeric("max_score", { precision: 6, scale:  2 }),
	teacherComments: text("teacher_comments"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	scanStatus: scanVerdictInCore("scan_status").default('pending').notNull(),
}, (table) => [
	index("idx_work_samples_student").using("btree", table.studentId.asc().nullsLast().op("date_ops"), table.workDate.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "work_samples_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "work_samples_subject_id_fkey"
		}),
	foreignKey({
			columns: [table.submittedBy],
			foreignColumns: [usersInCore.id],
			name: "work_samples_submitted_by_fkey"
		}),
]);

export const goalUpdatesInCore = core.table("goal_updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	goalId: uuid("goal_id").notNull(),
	note: text(),
	progress: smallint(),
	updatedBy: uuid("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goalsInCore.id],
			name: "goal_updates_goal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [usersInCore.id],
			name: "goal_updates_updated_by_fkey"
		}),
]);

export const sessionActivitiesInCore = core.table("session_activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	activityType: activityTypeInCore("activity_type").notNull(),
	subjectId: uuid("subject_id"),
	topic: varchar({ length: 200 }),
	difficulty: varchar({ length: 50 }),
	attempted: integer(),
	correct: integer(),
	incorrect: integer(),
	hintsUsed: integer("hints_used"),
	engagementLevel: smallint("engagement_level"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_session_activities_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [aiSessionsInCore.id],
			name: "session_activities_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "session_activities_subject_id_fkey"
		}),
	check("session_activities_engagement_level_check", sql`(engagement_level >= 1) AND (engagement_level <= 5)`),
]);

export const observationsInCore = core.table("observations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	category: varchar({ length: 100 }).notNull(),
	statement: text().notNull(),
	evidenceSource: evidenceSourceInCore("evidence_source").notNull(),
	evidenceRef: uuid("evidence_ref"),
	confidence: numeric({ precision: 4, scale:  3 }),
	sourceRole: dataSourceInCore("source_role").notNull(),
	proposedChange: jsonb("proposed_change"),
	status: observationStatusInCore().default('unverified').notNull(),
	synthesisBatchId: uuid("synthesis_batch_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modelVersion: varchar("model_version", { length: 100 }),
}, (table) => [
	index("idx_observations_queue").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.createdAt.desc().nullsFirst().op("enum_ops")),
	index("idx_observations_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "observations_student_id_fkey"
		}).onDelete("cascade"),
]);

export const goalsInCore = core.table("goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	goalType: goalTypeInCore("goal_type").notNull(),
	subjectId: uuid("subject_id"),
	title: varchar({ length: 300 }).notNull(),
	description: text(),
	requestedByRole: dataSourceInCore("requested_by_role").notNull(),
	requestedByUser: uuid("requested_by_user"),
	status: goalStatusInCore().default('proposed').notNull(),
	startDate: date("start_date"),
	targetDate: date("target_date"),
	reviewDate: date("review_date"),
}, (table) => [
	index("idx_goals_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.requestedByUser],
			foreignColumns: [usersInCore.id],
			name: "goals_requested_by_user_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [studentsInCore.id],
			name: "goals_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjectsInCore.id],
			name: "goals_subject_id_fkey"
		}),
]);
export const vStudentAccessInCore = core.view("v_student_access", {	userId: uuid("user_id"),
	studentId: uuid("student_id"),
	via: text(),
}).as(sql`SELECT ct.user_id, e.student_id, 'class'::text AS via FROM core.class_teachers ct JOIN core.class_enrollments e ON e.class_id = ct.class_id WHERE e.end_date IS NULL OR e.end_date >= CURRENT_DATE UNION SELECT st.user_id, st.student_id, 'direct'::text AS via FROM core.student_teachers st WHERE st.end_date IS NULL OR st.end_date >= CURRENT_DATE`);

export const vStudentCurrentClassesInCore = core.view("v_student_current_classes", {	studentId: uuid("student_id"),
	classId: uuid("class_id"),
	className: varchar("class_name", { length: 100 }),
	programme: varchar({ length: 100 }),
	branchId: uuid("branch_id"),
	startDate: date("start_date"),
}).as(sql`SELECT e.student_id, c.id AS class_id, c.name AS class_name, c.programme, c.branch_id, e.start_date FROM core.class_enrollments e JOIN core.classes c ON c.id = e.class_id WHERE e.end_date IS NULL OR e.end_date >= CURRENT_DATE`);

export const vCurrentLevelsInCore = core.view("v_current_levels", {	studentId: uuid("student_id"),
	kind: levelKindInCore(),
	key: varchar({ length: 80 }),
	subjectId: uuid("subject_id"),
	score: smallint(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	setByObservationId: uuid("set_by_observation_id"),
	setByUserId: uuid("set_by_user_id"),
}).as(sql`SELECT DISTINCT ON (student_id, kind, key) student_id, kind, key, subject_id, score, effective_from, set_by_observation_id, set_by_user_id FROM core.student_levels ORDER BY student_id, kind, key, effective_from DESC`);

export const vCurrentConsentsInCore = core.view("v_current_consents", {	studentId: uuid("student_id"),
	consentType: consentTypeInCore("consent_type"),
	status: consentStatusInCore(),
	method: consentMethodInCore(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }),
	withdrawnAt: timestamp("withdrawn_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT DISTINCT ON (student_id, consent_type) student_id, consent_type, status, method, granted_at, withdrawn_at, created_at FROM core.consents ORDER BY student_id, consent_type, created_at DESC`);