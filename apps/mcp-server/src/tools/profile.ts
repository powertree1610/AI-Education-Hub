import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { STUDENT_REF, defineTool } from "../define-tool.js";

export function registerProfileTools(server: McpServer): void {
  defineTool(server, {
    name: "get_student_learning_profile",
    description:
      "The teacher-approved learning profile for one student: basics (age, grade, languages, AI access level), " +
      "current skill/development levels, interests with their source, and active goals. " +
      "Excludes health, safeguarding and unverified observations by construction.",
    inputSchema: {
      student_id: STUDENT_REF,
    },
    consent: ["basic_profile"],
    handler: async (input, { db, consents, studentId }) => {
      const student = (
        await db.select().from(s.students).where(eq(s.students.id, studentId)).limit(1)
      )[0];
      if (!student) throw new Error("Student not found");

      const age = Math.floor(
        (Date.now() - new Date(student.dob).getTime()) / (365.25 * 24 * 3600 * 1000),
      );

      const interests = await db
        .select({
          name: s.interests.name,
          kind: s.studentInterests.kind,
          freeText: s.studentInterests.freeText,
          source: s.studentInterests.source,
        })
        .from(s.studentInterests)
        .leftJoin(s.interests, eq(s.interests.id, s.studentInterests.interestId))
        .where(eq(s.studentInterests.studentId, studentId));

      // Levels and goals are development-tracking data — included only when
      // that consent is also granted.
      const devTracking = consents.get("development_tracking") === "granted";

      const levels = devTracking
        ? await db
            .select({
              kind: s.vCurrentLevels.kind,
              key: s.vCurrentLevels.key,
              score: s.vCurrentLevels.score,
              effectiveFrom: s.vCurrentLevels.effectiveFrom,
            })
            .from(s.vCurrentLevels)
            .where(eq(s.vCurrentLevels.studentId, studentId))
        : [];

      const activeGoals = devTracking
        ? await db
            .select({
              id: s.goals.id,
              goalType: s.goals.goalType,
              title: s.goals.title,
              description: s.goals.description,
              status: s.goals.status,
              targetDate: s.goals.targetDate,
            })
            .from(s.goals)
            .where(
              and(
                eq(s.goals.studentId, studentId),
                inArray(s.goals.status, ["active", "improving"]),
              ),
            )
        : [];

      return {
        student: {
          preferred_name: student.preferredName ?? student.fullName,
          age,
          gender: student.gender,
          school_grade: student.schoolGrade,
          curriculum: student.curriculum,
          school_type: student.schoolType,
          main_school_language: student.mainSchoolLanguage,
          primary_home_language: student.primaryHomeLanguage,
          preferred_ai_language: student.preferredAiLanguage,
          ai_access_level: student.aiAccessLevel,
        },
        current_levels: levels,
        interests: interests.map((i) => ({
          name: i.name ?? i.freeText,
          kind: i.kind,
          source: i.source,
        })),
        active_goals: activeGoals,
        ...(devTracking
          ? {}
          : { note: "Levels and goals omitted: development_tracking consent not granted" }),
      };
    },
  });
}
