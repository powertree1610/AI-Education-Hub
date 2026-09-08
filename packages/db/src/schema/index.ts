// Barrel for the introspected schema (schema.ts / relations.ts are generated
// by `drizzle-kit pull` — do not hand-edit beyond the documented citext fix)
// plus the v1-added agent chat tables.
export * from "./schema.js";
export * from "./relations.js";
export * from "./agent-chats.js";
export * from "./ai-usage-logs.js";
export * from "./schools.js";
export * from "./work-sample-texts.js";
export * from "./teaching-materials.js";

// Friendly aliases — downstream code reads `students`, not `studentsInCore`.
export {
  branchesInCore as branches,
  usersInCore as users,
  staffProfilesInCore as staffProfiles,
  guardiansInCore as guardians,
  studentsInCore as students,
  studentGuardiansInCore as studentGuardians,
  classesInCore as classes,
  classEnrollmentsInCore as classEnrollments,
  classTeachersInCore as classTeachers,
  studentTeachersInCore as studentTeachers,
  subjectsInCore as subjects,
  studentSubjectsInCore as studentSubjects,
  interestsInCore as interests,
  traitsInCore as traits,
  formSubmissionsInCore as formSubmissions,
  academicAssessmentsInCore as academicAssessments,
  traitObservationsInCore as traitObservations,
  studentInterestsInCore as studentInterests,
  consentsInCore as consents,
  workSamplesInCore as workSamples,
  workAnalysesInCore as workAnalyses,
  uploadScansInCore as uploadScans,
  academicResultsInCore as academicResults,
  aiSessionsInCore as aiSessions,
  sessionActivitiesInCore as sessionActivities,
  sessionTranscriptsInCore as sessionTranscripts,
  safetyEventsInCore as safetyEvents,
  observationsInCore as observations,
  observationReviewsInCore as observationReviews,
  studentLevelsInCore as studentLevels,
  goalsInCore as goals,
  goalUpdatesInCore as goalUpdates,
  progressReportsInCore as progressReports,
  auditLogInCore as auditLog,
  vStudentAccessInCore as vStudentAccess,
  vStudentCurrentClassesInCore as vStudentCurrentClasses,
  vCurrentLevelsInCore as vCurrentLevels,
  vCurrentConsentsInCore as vCurrentConsents,
} from "./schema.js";

export {
  agentChatsInCore as agentChats,
  agentChatMessagesInCore as agentChatMessages,
} from "./agent-chats.js";

export { aiUsageLogsInCore as aiUsageLogs } from "./ai-usage-logs.js";
export { schoolsInCore as schools } from "./schools.js";
export { workSampleTextsInCore as workSampleTexts } from "./work-sample-texts.js";
export {
  teachingMaterialsInCore as teachingMaterials,
  teachingMaterialTextsInCore as teachingMaterialTexts,
} from "./teaching-materials.js";
