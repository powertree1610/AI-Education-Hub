import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { defineTool } from "../define-tool.js";
import { studentIdOfWorkSample, subjectIdByCode } from "./util.js";

const FINDINGS_SCHEMA = z.object({
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  recurring_mistakes: z.array(z.string()),
  skills_shown: z.array(z.string()),
});

export function registerWorkTools(server: McpServer): void {
  defineTool(server, {
    name: "get_work_samples",
    description:
      "Uploaded work samples (essays, worksheets, drawings…) for one student — metadata and file references. " +
      "Use read_work_sample_file (app-side) to read a file's content; originals are immutable.",
    inputSchema: {
      student_id: z.string().uuid(),
      subject_code: z.string().optional(),
      work_type: z.enum(s.workTypeInCore.enumValues).optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
    consent: ["work_uploads"],
    handler: async (input, { db }) => {
      const filters: SQL[] = [
        eq(s.workSamples.studentId, input.student_id),
        // Only cleanly scanned files ever reach the AI.
        eq(s.workSamples.scanStatus, "clean"),
      ];
      if (input.subject_code) {
        const subjectId = await subjectIdByCode(db, input.subject_code);
        if (!subjectId) throw new Error(`Unknown subject code: ${input.subject_code}`);
        filters.push(eq(s.workSamples.subjectId, subjectId));
      }
      if (input.work_type) filters.push(eq(s.workSamples.workType, input.work_type));

      const rows = await db
        .select({
          work_sample_id: s.workSamples.id,
          work_type: s.workSamples.workType,
          title_topic: s.workSamples.titleTopic,
          work_date: s.workSamples.workDate,
          school_year: s.workSamples.schoolYear,
          source: s.workSamples.source,
          subject: s.subjects.name,
          file_url: s.workSamples.fileUrl,
          file_type: s.workSamples.fileType,
          teacher_score: s.workSamples.teacherScore,
          max_score: s.workSamples.maxScore,
          teacher_comments: s.workSamples.teacherComments,
        })
        .from(s.workSamples)
        .leftJoin(s.subjects, eq(s.subjects.id, s.workSamples.subjectId))
        .where(and(...filters))
        .orderBy(desc(s.workSamples.createdAt))
        .limit(input.limit);

      return { work_samples: rows };
    },
  });

  defineTool(server, {
    name: "get_work_analyses",
    description:
      "Prior AI analyses of a student's work, including their teacher review status — " +
      "use this to compare with previous work and avoid duplicate analyses.",
    inputSchema: {
      student_id: z.string().uuid().optional(),
      work_sample_id: z.string().uuid().optional(),
    },
    consent: ["work_uploads", "ai_work_analysis"],
    resolveStudentId: async (input, db) => {
      if (input.student_id) return input.student_id;
      if (input.work_sample_id) return studentIdOfWorkSample(db, input.work_sample_id);
      return null;
    },
    handler: async (input, { db, studentId }) => {
      const filters: SQL[] = [eq(s.workSamples.studentId, studentId)];
      if (input.work_sample_id) filters.push(eq(s.workAnalyses.workSampleId, input.work_sample_id));

      const rows = await db
        .select({
          work_analysis_id: s.workAnalyses.id,
          work_sample_id: s.workAnalyses.workSampleId,
          title_topic: s.workSamples.titleTopic,
          analyzed_at: s.workAnalyses.analyzedAt,
          findings: s.workAnalyses.findings,
          suggested_next_activity: s.workAnalyses.suggestedNextActivity,
          confidence: s.workAnalyses.confidence,
          review_status: s.workAnalyses.reviewStatus,
          reviewer_notes: s.workAnalyses.reviewerNotes,
        })
        .from(s.workAnalyses)
        .innerJoin(s.workSamples, eq(s.workSamples.id, s.workAnalyses.workSampleId))
        .where(and(...filters))
        .orderBy(desc(s.workAnalyses.analyzedAt));

      return { work_analyses: rows };
    },
  });

  defineTool(server, {
    name: "save_work_analysis",
    description:
      "Save an AI analysis of one work sample. It is stored as pending_review — a teacher must confirm it " +
      "before it counts. Never modifies the original work. Interests and creativity only; no psychological inference.",
    inputSchema: {
      work_sample_id: z.string().uuid(),
      findings: FINDINGS_SCHEMA,
      suggested_next_activity: z.string().optional(),
      confidence: z.number().min(0).max(1),
      model_version: z.string().optional(),
    },
    consent: ["work_uploads", "ai_work_analysis"],
    resolveStudentId: (input, db) => studentIdOfWorkSample(db, input.work_sample_id),
    handler: async (input, { db }) => {
      const [row] = await db
        .insert(s.workAnalyses)
        .values({
          workSampleId: input.work_sample_id,
          findings: input.findings,
          suggestedNextActivity: input.suggested_next_activity ?? null,
          confidence: String(input.confidence),
          modelVersion: input.model_version ?? null,
          reviewStatus: "pending_review",
        })
        .returning({ id: s.workAnalyses.id });

      return {
        work_analysis_id: row!.id,
        review_status: "pending_review",
        note: "Stored for teacher review — it is not part of the approved profile until confirmed.",
      };
    },
  });
}
