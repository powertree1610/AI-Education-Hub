import { relations } from "drizzle-orm/relations";
import { studentsInCore, formSubmissionsInCore, usersInCore, aiSessionsInCore, sessionTranscriptsInCore, workAnalysesInCore, workSamplesInCore, branchesInCore, classesInCore, guardiansInCore, observationsInCore, observationReviewsInCore, progressReportsInCore, classEnrollmentsInCore, classTeachersInCore, staffProfilesInCore, consentsInCore, auditLogInCore, safetyEventsInCore, studentGuardiansInCore, studentTeachersInCore, subjectsInCore, uploadScansInCore, studentLevelsInCore, studentSubjectsInCore, interestsInCore, studentInterestsInCore, traitObservationsInCore, traitsInCore, academicAssessmentsInCore, academicResultsInCore, goalsInCore, goalUpdatesInCore, sessionActivitiesInCore } from "./schema.js";

export const formSubmissionsInCoreRelations = relations(formSubmissionsInCore, ({one, many}) => ({
	studentsInCore: one(studentsInCore, {
		fields: [formSubmissionsInCore.studentId],
		references: [studentsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [formSubmissionsInCore.submittedBy],
		references: [usersInCore.id]
	}),
	traitObservationsInCores: many(traitObservationsInCore),
	academicAssessmentsInCores: many(academicAssessmentsInCore),
}));

export const studentsInCoreRelations = relations(studentsInCore, ({one, many}) => ({
	formSubmissionsInCores: many(formSubmissionsInCore),
	progressReportsInCores: many(progressReportsInCore),
	classEnrollmentsInCores: many(classEnrollmentsInCore),
	consentsInCores: many(consentsInCore),
	safetyEventsInCores: many(safetyEventsInCore),
	studentGuardiansInCores: many(studentGuardiansInCore),
	studentTeachersInCores: many(studentTeachersInCore),
	studentLevelsInCores: many(studentLevelsInCore),
	aiSessionsInCores: many(aiSessionsInCore),
	branchesInCore: one(branchesInCore, {
		fields: [studentsInCore.branchId],
		references: [branchesInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [studentsInCore.userId],
		references: [usersInCore.id]
	}),
	studentSubjectsInCores: many(studentSubjectsInCore),
	studentInterestsInCores: many(studentInterestsInCore),
	traitObservationsInCores: many(traitObservationsInCore),
	academicAssessmentsInCores: many(academicAssessmentsInCore),
	academicResultsInCores: many(academicResultsInCore),
	workSamplesInCores: many(workSamplesInCore),
	observationsInCores: many(observationsInCore),
	goalsInCores: many(goalsInCore),
}));

export const usersInCoreRelations = relations(usersInCore, ({many}) => ({
	formSubmissionsInCores: many(formSubmissionsInCore),
	workAnalysesInCores: many(workAnalysesInCore),
	guardiansInCores: many(guardiansInCore),
	observationReviewsInCores: many(observationReviewsInCore),
	progressReportsInCores_publishedBy: many(progressReportsInCore, {
		relationName: "progressReportsInCore_publishedBy_usersInCore_id"
	}),
	progressReportsInCores_reviewedBy: many(progressReportsInCore, {
		relationName: "progressReportsInCore_reviewedBy_usersInCore_id"
	}),
	classTeachersInCores: many(classTeachersInCore),
	staffProfilesInCores: many(staffProfilesInCore),
	consentsInCores: many(consentsInCore),
	auditLogInCores: many(auditLogInCore),
	safetyEventsInCores: many(safetyEventsInCore),
	studentTeachersInCores: many(studentTeachersInCore),
	studentLevelsInCores: many(studentLevelsInCore),
	aiSessionsInCores: many(aiSessionsInCore),
	studentsInCores: many(studentsInCore),
	academicAssessmentsInCores: many(academicAssessmentsInCore),
	academicResultsInCores: many(academicResultsInCore),
	workSamplesInCores: many(workSamplesInCore),
	goalUpdatesInCores: many(goalUpdatesInCore),
	goalsInCores: many(goalsInCore),
}));

export const sessionTranscriptsInCoreRelations = relations(sessionTranscriptsInCore, ({one}) => ({
	aiSessionsInCore: one(aiSessionsInCore, {
		fields: [sessionTranscriptsInCore.sessionId],
		references: [aiSessionsInCore.id]
	}),
}));

export const aiSessionsInCoreRelations = relations(aiSessionsInCore, ({one, many}) => ({
	sessionTranscriptsInCores: many(sessionTranscriptsInCore),
	safetyEventsInCores: many(safetyEventsInCore),
	usersInCore: one(usersInCore, {
		fields: [aiSessionsInCore.startedBy],
		references: [usersInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [aiSessionsInCore.studentId],
		references: [studentsInCore.id]
	}),
	sessionActivitiesInCores: many(sessionActivitiesInCore),
}));

export const workAnalysesInCoreRelations = relations(workAnalysesInCore, ({one}) => ({
	usersInCore: one(usersInCore, {
		fields: [workAnalysesInCore.reviewedBy],
		references: [usersInCore.id]
	}),
	workSamplesInCore: one(workSamplesInCore, {
		fields: [workAnalysesInCore.workSampleId],
		references: [workSamplesInCore.id]
	}),
}));

export const workSamplesInCoreRelations = relations(workSamplesInCore, ({one, many}) => ({
	workAnalysesInCores: many(workAnalysesInCore),
	safetyEventsInCores: many(safetyEventsInCore),
	uploadScansInCores: many(uploadScansInCore),
	studentsInCore: one(studentsInCore, {
		fields: [workSamplesInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [workSamplesInCore.subjectId],
		references: [subjectsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [workSamplesInCore.submittedBy],
		references: [usersInCore.id]
	}),
}));

export const classesInCoreRelations = relations(classesInCore, ({one, many}) => ({
	branchesInCore: one(branchesInCore, {
		fields: [classesInCore.branchId],
		references: [branchesInCore.id]
	}),
	classEnrollmentsInCores: many(classEnrollmentsInCore),
	classTeachersInCores: many(classTeachersInCore),
}));

export const branchesInCoreRelations = relations(branchesInCore, ({many}) => ({
	classesInCores: many(classesInCore),
	staffProfilesInCores: many(staffProfilesInCore),
	studentsInCores: many(studentsInCore),
}));

export const guardiansInCoreRelations = relations(guardiansInCore, ({one, many}) => ({
	usersInCore: one(usersInCore, {
		fields: [guardiansInCore.userId],
		references: [usersInCore.id]
	}),
	consentsInCores: many(consentsInCore),
	studentGuardiansInCores: many(studentGuardiansInCore),
}));

export const observationReviewsInCoreRelations = relations(observationReviewsInCore, ({one}) => ({
	observationsInCore: one(observationsInCore, {
		fields: [observationReviewsInCore.observationId],
		references: [observationsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [observationReviewsInCore.reviewerId],
		references: [usersInCore.id]
	}),
}));

export const observationsInCoreRelations = relations(observationsInCore, ({one, many}) => ({
	observationReviewsInCores: many(observationReviewsInCore),
	studentLevelsInCores: many(studentLevelsInCore),
	studentsInCore: one(studentsInCore, {
		fields: [observationsInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const progressReportsInCoreRelations = relations(progressReportsInCore, ({one}) => ({
	usersInCore_publishedBy: one(usersInCore, {
		fields: [progressReportsInCore.publishedBy],
		references: [usersInCore.id],
		relationName: "progressReportsInCore_publishedBy_usersInCore_id"
	}),
	usersInCore_reviewedBy: one(usersInCore, {
		fields: [progressReportsInCore.reviewedBy],
		references: [usersInCore.id],
		relationName: "progressReportsInCore_reviewedBy_usersInCore_id"
	}),
	studentsInCore: one(studentsInCore, {
		fields: [progressReportsInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const classEnrollmentsInCoreRelations = relations(classEnrollmentsInCore, ({one}) => ({
	classesInCore: one(classesInCore, {
		fields: [classEnrollmentsInCore.classId],
		references: [classesInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [classEnrollmentsInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const classTeachersInCoreRelations = relations(classTeachersInCore, ({one}) => ({
	classesInCore: one(classesInCore, {
		fields: [classTeachersInCore.classId],
		references: [classesInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [classTeachersInCore.userId],
		references: [usersInCore.id]
	}),
}));

export const staffProfilesInCoreRelations = relations(staffProfilesInCore, ({one}) => ({
	branchesInCore: one(branchesInCore, {
		fields: [staffProfilesInCore.branchId],
		references: [branchesInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [staffProfilesInCore.userId],
		references: [usersInCore.id]
	}),
}));

export const consentsInCoreRelations = relations(consentsInCore, ({one}) => ({
	guardiansInCore: one(guardiansInCore, {
		fields: [consentsInCore.guardianId],
		references: [guardiansInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [consentsInCore.recordedBy],
		references: [usersInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [consentsInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const auditLogInCoreRelations = relations(auditLogInCore, ({one}) => ({
	usersInCore: one(usersInCore, {
		fields: [auditLogInCore.actorId],
		references: [usersInCore.id]
	}),
}));

export const safetyEventsInCoreRelations = relations(safetyEventsInCore, ({one}) => ({
	usersInCore: one(usersInCore, {
		fields: [safetyEventsInCore.reviewedBy],
		references: [usersInCore.id]
	}),
	aiSessionsInCore: one(aiSessionsInCore, {
		fields: [safetyEventsInCore.sessionId],
		references: [aiSessionsInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [safetyEventsInCore.studentId],
		references: [studentsInCore.id]
	}),
	workSamplesInCore: one(workSamplesInCore, {
		fields: [safetyEventsInCore.workSampleId],
		references: [workSamplesInCore.id]
	}),
}));

export const studentGuardiansInCoreRelations = relations(studentGuardiansInCore, ({one}) => ({
	guardiansInCore: one(guardiansInCore, {
		fields: [studentGuardiansInCore.guardianId],
		references: [guardiansInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [studentGuardiansInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const studentTeachersInCoreRelations = relations(studentTeachersInCore, ({one}) => ({
	studentsInCore: one(studentsInCore, {
		fields: [studentTeachersInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [studentTeachersInCore.subjectId],
		references: [subjectsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [studentTeachersInCore.userId],
		references: [usersInCore.id]
	}),
}));

export const subjectsInCoreRelations = relations(subjectsInCore, ({many}) => ({
	studentTeachersInCores: many(studentTeachersInCore),
	studentLevelsInCores: many(studentLevelsInCore),
	studentSubjectsInCores: many(studentSubjectsInCore),
	academicAssessmentsInCores: many(academicAssessmentsInCore),
	academicResultsInCores: many(academicResultsInCore),
	workSamplesInCores: many(workSamplesInCore),
	sessionActivitiesInCores: many(sessionActivitiesInCore),
	goalsInCores: many(goalsInCore),
}));

export const uploadScansInCoreRelations = relations(uploadScansInCore, ({one}) => ({
	workSamplesInCore: one(workSamplesInCore, {
		fields: [uploadScansInCore.workSampleId],
		references: [workSamplesInCore.id]
	}),
}));

export const studentLevelsInCoreRelations = relations(studentLevelsInCore, ({one}) => ({
	observationsInCore: one(observationsInCore, {
		fields: [studentLevelsInCore.setByObservationId],
		references: [observationsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [studentLevelsInCore.setByUserId],
		references: [usersInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [studentLevelsInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [studentLevelsInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));

export const studentSubjectsInCoreRelations = relations(studentSubjectsInCore, ({one}) => ({
	studentsInCore: one(studentsInCore, {
		fields: [studentSubjectsInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [studentSubjectsInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));

export const studentInterestsInCoreRelations = relations(studentInterestsInCore, ({one}) => ({
	interestsInCore: one(interestsInCore, {
		fields: [studentInterestsInCore.interestId],
		references: [interestsInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [studentInterestsInCore.studentId],
		references: [studentsInCore.id]
	}),
}));

export const interestsInCoreRelations = relations(interestsInCore, ({many}) => ({
	studentInterestsInCores: many(studentInterestsInCore),
}));

export const traitObservationsInCoreRelations = relations(traitObservationsInCore, ({one}) => ({
	formSubmissionsInCore: one(formSubmissionsInCore, {
		fields: [traitObservationsInCore.formSubmissionId],
		references: [formSubmissionsInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [traitObservationsInCore.studentId],
		references: [studentsInCore.id]
	}),
	traitsInCore: one(traitsInCore, {
		fields: [traitObservationsInCore.traitId],
		references: [traitsInCore.id]
	}),
}));

export const traitsInCoreRelations = relations(traitsInCore, ({many}) => ({
	traitObservationsInCores: many(traitObservationsInCore),
}));

export const academicAssessmentsInCoreRelations = relations(academicAssessmentsInCore, ({one}) => ({
	usersInCore: one(usersInCore, {
		fields: [academicAssessmentsInCore.assessorId],
		references: [usersInCore.id]
	}),
	formSubmissionsInCore: one(formSubmissionsInCore, {
		fields: [academicAssessmentsInCore.formSubmissionId],
		references: [formSubmissionsInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [academicAssessmentsInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [academicAssessmentsInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));

export const academicResultsInCoreRelations = relations(academicResultsInCore, ({one}) => ({
	usersInCore: one(usersInCore, {
		fields: [academicResultsInCore.enteredBy],
		references: [usersInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [academicResultsInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [academicResultsInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));

export const goalUpdatesInCoreRelations = relations(goalUpdatesInCore, ({one}) => ({
	goalsInCore: one(goalsInCore, {
		fields: [goalUpdatesInCore.goalId],
		references: [goalsInCore.id]
	}),
	usersInCore: one(usersInCore, {
		fields: [goalUpdatesInCore.updatedBy],
		references: [usersInCore.id]
	}),
}));

export const goalsInCoreRelations = relations(goalsInCore, ({one, many}) => ({
	goalUpdatesInCores: many(goalUpdatesInCore),
	usersInCore: one(usersInCore, {
		fields: [goalsInCore.requestedByUser],
		references: [usersInCore.id]
	}),
	studentsInCore: one(studentsInCore, {
		fields: [goalsInCore.studentId],
		references: [studentsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [goalsInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));

export const sessionActivitiesInCoreRelations = relations(sessionActivitiesInCore, ({one}) => ({
	aiSessionsInCore: one(aiSessionsInCore, {
		fields: [sessionActivitiesInCore.sessionId],
		references: [aiSessionsInCore.id]
	}),
	subjectsInCore: one(subjectsInCore, {
		fields: [sessionActivitiesInCore.subjectId],
		references: [subjectsInCore.id]
	}),
}));