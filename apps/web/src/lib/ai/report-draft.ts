import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { schema as s, type Db } from "@platform/db";
import { chatCompletion, parseModelJson } from "./central-api";
import { resolveChatModel } from "./license";

/**
 * AI-drafted term progress report (M10). Gathers the child's data directly
 * (app_user) and asks the chat model for a parent-friendly JSON draft.
 * The draft ALWAYS lands as pending_review — a teacher edits and publishes.
 */

export interface ReportDraft {
  summary: string;
  results_trend: string;
  goals_achieved: number;
  highlights: string[];
}

const SYSTEM = `You write termly progress reports for parents of primary-school children at a tuition centre. You are given the child's data; write warmly but factually — no exaggeration, no psychological labels, no comparisons to other children. Mention concrete evidence (results, quiz outcomes, goals). Write in English unless the data clearly suggests another language preference for the family.

Reply with ONLY a JSON object, no code fences:
{"summary": "3-6 sentences for the parent", "results_trend": "one line, e.g. 'English 58 → 62'", "goals_achieved": <number>, "highlights": ["2-4 short bullet points"]}`;

export async function generateReportDraft(
  db: Db,
  studentId: string,
  period: string,
): Promise<{ draft: ReportDraft; model: string }> {
  const student = (await db.select().from(s.students).where(eq(s.students.id, studentId)).limit(1))[0];
  if (!student) throw new Error("Student not found");

  const results = await db
    .select({
      subject: s.subjects.name,
      type: s.academicResults.assessmentType,
      date: s.academicResults.assessmentDate,
      score: s.academicResults.score,
      max: s.academicResults.maxScore,
      grade: s.academicResults.grade,
    })
    .from(s.academicResults)
    .innerJoin(s.subjects, eq(s.subjects.id, s.academicResults.subjectId))
    .where(eq(s.academicResults.studentId, studentId))
    .orderBy(asc(s.academicResults.assessmentDate));

  const levels = await db
    .select({ kind: s.vCurrentLevels.kind, key: s.vCurrentLevels.key, score: s.vCurrentLevels.score })
    .from(s.vCurrentLevels)
    .where(eq(s.vCurrentLevels.studentId, studentId));

  const goals = await db.select().from(s.goals).where(eq(s.goals.studentId, studentId));

  const observations = await db
    .select({ statement: s.observations.statement, category: s.observations.category })
    .from(s.observations)
    .where(eq(s.observations.studentId, studentId))
    .orderBy(desc(s.observations.createdAt))
    .limit(20);
  const approvedObservations = await db
    .select({ statement: s.observations.statement })
    .from(s.observations)
    .where(
      and(
        eq(s.observations.studentId, studentId),
        inArray(s.observations.status, ["approved", "partially_approved"]),
      ),
    )
    .orderBy(desc(s.observations.createdAt))
    .limit(10);

  const sessions = await db
    .select({ startedAt: s.aiSessions.startedAt })
    .from(s.aiSessions)
    .where(eq(s.aiSessions.studentId, studentId));

  const achieved = goals.filter((g) => g.status === "achieved").length;
  const context = {
    child: {
      preferred_name: student.preferredName ?? student.fullName,
      grade: student.schoolGrade,
    },
    period,
    results,
    current_levels: levels,
    goals: goals.map((g) => ({ title: g.title, status: g.status, requested_by: g.requestedByRole })),
    goals_achieved_count: achieved,
    teacher_approved_observations: approvedObservations.map((o) => o.statement),
    recent_observation_categories: observations.map((o) => o.category),
    ai_sessions_count: sessions.length,
  };

  const model = await resolveChatModel("staff");
  const res = await chatCompletion({
    model,
    max_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(context) },
    ],
    usageContext: { feature: "progress_report", studentId },
  });

  const raw = String(res.choices?.[0]?.message?.content ?? "").trim();
  let draft: ReportDraft;
  try {
    const parsed = parseModelJson<Partial<ReportDraft>>(raw);
    draft = {
      summary: String(parsed.summary ?? ""),
      results_trend: String(parsed.results_trend ?? ""),
      goals_achieved: Number(parsed.goals_achieved ?? achieved),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
    };
  } catch {
    // Model didn't return clean JSON — keep the text so the teacher can still edit.
    draft = { summary: raw, results_trend: "", goals_achieved: achieved, highlights: [] };
  }
  return { draft, model };
}
