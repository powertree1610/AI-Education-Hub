import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, asc, eq, gte, type SQL } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@platform/db";
import { STUDENT_REF, defineTool } from "../define-tool.js";
import { subjectIdByCode } from "./util.js";

export function registerResultsTools(server: McpServer): void {
  defineTool(server, {
    name: "get_academic_results",
    description:
      "School and centre exam/test results for one student over time, with a computed per-subject trend. " +
      "Optionally filter by subject code (e.g. ENG, MATH) or a start date.",
    inputSchema: {
      student_id: STUDENT_REF,
      subject_code: z.string().optional(),
      since: z.string().date().optional(),
    },
    consent: ["academic_data"],
    handler: async (input, { db, studentId }) => {
      const filters: SQL[] = [eq(s.academicResults.studentId, studentId)];
      if (input.subject_code) {
        const subjectId = await subjectIdByCode(db, input.subject_code);
        if (!subjectId) throw new Error(`Unknown subject code: ${input.subject_code}`);
        filters.push(eq(s.academicResults.subjectId, subjectId));
      }
      if (input.since) filters.push(gte(s.academicResults.assessmentDate, input.since));

      const rows = await db
        .select({
          subject: s.subjects.name,
          subjectCode: s.subjects.code,
          assessmentType: s.academicResults.assessmentType,
          assessmentDate: s.academicResults.assessmentDate,
          schoolYear: s.academicResults.schoolYear,
          term: s.academicResults.term,
          score: s.academicResults.score,
          maxScore: s.academicResults.maxScore,
          grade: s.academicResults.grade,
          classPosition: s.academicResults.classPosition,
          teacherComment: s.academicResults.teacherComment,
          source: s.academicResults.source,
        })
        .from(s.academicResults)
        .innerJoin(s.subjects, eq(s.subjects.id, s.academicResults.subjectId))
        .where(and(...filters))
        .orderBy(asc(s.academicResults.assessmentDate));

      // Trend per subject: first vs last percentage. Computed, never stored.
      const bySubject = new Map<string, { first: number; last: number; n: number }>();
      for (const r of rows) {
        if (r.score == null || r.maxScore == null || Number(r.maxScore) === 0) continue;
        const pct = (Number(r.score) / Number(r.maxScore)) * 100;
        const entry = bySubject.get(r.subjectCode);
        if (!entry) bySubject.set(r.subjectCode, { first: pct, last: pct, n: 1 });
        else {
          entry.last = pct;
          entry.n++;
        }
      }
      const trends = [...bySubject.entries()].map(([code, t]) => ({
        subject_code: code,
        results_count: t.n,
        first_pct: Math.round(t.first),
        latest_pct: Math.round(t.last),
        direction: t.n < 2 ? "insufficient_data" : t.last > t.first + 2 ? "improving" : t.last < t.first - 2 ? "declining" : "stable",
      }));

      return { results: rows, trends };
    },
  });
}
