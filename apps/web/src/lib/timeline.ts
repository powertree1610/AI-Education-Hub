import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema as s, type Db } from "@platform/db";

/**
 * Development timeline (v7): one chronological view assembled from data the
 * platform already records — nothing new is written. Two audiences:
 *  - "staff": everything below.
 *  - "parent": only what the parent portal already shows elsewhere (levels,
 *    goals, results, reports, work) — observations, intake forms and
 *    teaching materials stay staff-side. The fuller role+age access matrix
 *    is deferred to the privacy slice (PM to discuss with the client).
 */

export type TimelineEventType =
  | "level"
  | "observation"
  | "goal"
  | "result"
  | "work"
  | "report"
  | "form"
  | "material";

export interface TimelineEvent {
  at: string; // ISO timestamp or YYYY-MM-DD
  type: TimelineEventType;
  title: string;
  detail?: string | null;
}

export const TIMELINE_TYPE_LABELS: Record<TimelineEventType, string> = {
  level: "Level",
  observation: "Observation",
  goal: "Goal",
  result: "Result",
  work: "Work",
  report: "Report",
  form: "Intake",
  material: "Material",
};

const PARENT_TYPES: ReadonlySet<TimelineEventType> = new Set([
  "level",
  "goal",
  "result",
  "report",
  "work",
]);

const GOAL_AUDIT_ACTIONS = ["goal_created", "goal_activated", "goal_declined", "goal_status_changed"];

function levelKindLabel(kind: "academic_skill" | "development_area"): string {
  return kind === "academic_skill" ? "academic" : "development";
}

export async function buildTimeline(
  db: Db,
  studentId: string,
  audience: "staff" | "parent",
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // Levels — full history, with the change direction per (kind, key).
  const levels = await db
    .select({
      kind: s.studentLevels.kind,
      key: s.studentLevels.key,
      score: s.studentLevels.score,
      effectiveFrom: s.studentLevels.effectiveFrom,
    })
    .from(s.studentLevels)
    .where(eq(s.studentLevels.studentId, studentId))
    .orderBy(asc(s.studentLevels.effectiveFrom));
  const prevScore = new Map<string, number>();
  for (const l of levels) {
    const mapKey = `${l.kind}:${l.key}`;
    const prev = prevScore.get(mapKey);
    events.push({
      at: l.effectiveFrom,
      type: "level",
      title:
        prev === undefined
          ? `${l.key} level set: ${l.score}/5`
          : `${l.key} level: ${prev} → ${l.score}/5`,
      detail: levelKindLabel(l.kind),
    });
    prevScore.set(mapKey, l.score);
  }

  // Goal lifecycle — from the audit trail (goals rows carry no timestamps),
  // plus append-only progress notes.
  const goals = await db
    .select({ id: s.goals.id, title: s.goals.title })
    .from(s.goals)
    .where(eq(s.goals.studentId, studentId));
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  if (goals.length > 0) {
    const goalIds = [...goalTitle.keys()];
    const audits = await db
      .select({ action: s.auditLog.action, entityId: s.auditLog.entityId, details: s.auditLog.details, at: s.auditLog.at })
      .from(s.auditLog)
      .where(and(eq(s.auditLog.entityType, "goal"), inArray(s.auditLog.entityId, goalIds), inArray(s.auditLog.action, GOAL_AUDIT_ACTIONS)));
    for (const a of audits) {
      const title = goalTitle.get(a.entityId ?? "") ?? "goal";
      const d = (a.details ?? {}) as { from?: string; to?: string };
      events.push({
        at: a.at,
        type: "goal",
        title:
          a.action === "goal_created"
            ? `Goal set: “${title}”`
            : a.action === "goal_activated"
              ? `Goal activated: “${title}”`
              : a.action === "goal_declined"
                ? `Goal declined: “${title}”`
                : `Goal “${title}”: ${d.from ?? "?"} → ${d.to ?? "?"}`,
      });
    }
    const updates = await db
      .select({ goalId: s.goalUpdates.goalId, note: s.goalUpdates.note, progress: s.goalUpdates.progress, updatedAt: s.goalUpdates.updatedAt })
      .from(s.goalUpdates)
      .where(inArray(s.goalUpdates.goalId, goalIds));
    for (const u of updates) {
      events.push({
        at: u.updatedAt,
        type: "goal",
        title: `Progress on “${goalTitle.get(u.goalId) ?? "goal"}”${u.progress !== null ? `: ${u.progress}%` : ""}`,
        detail: u.note,
      });
    }
  }

  // Academic results.
  const results = await db
    .select({
      subject: s.subjects.name,
      assessmentType: s.academicResults.assessmentType,
      assessmentDate: s.academicResults.assessmentDate,
      score: s.academicResults.score,
      maxScore: s.academicResults.maxScore,
      grade: s.academicResults.grade,
    })
    .from(s.academicResults)
    .innerJoin(s.subjects, eq(s.subjects.id, s.academicResults.subjectId))
    .where(eq(s.academicResults.studentId, studentId));
  for (const r of results) {
    const score =
      r.score !== null ? `${Number(r.score)}${r.maxScore !== null ? `/${Number(r.maxScore)}` : ""}` : (r.grade ?? "");
    events.push({
      at: r.assessmentDate,
      type: "result",
      title: `${r.subject} ${r.assessmentType}: ${score}`,
    });
  }

  // Work samples.
  const works = await db
    .select({ title: s.workSamples.titleTopic, workType: s.workSamples.workType, source: s.workSamples.source, createdAt: s.workSamples.createdAt })
    .from(s.workSamples)
    .where(eq(s.workSamples.studentId, studentId));
  for (const w of works) {
    events.push({
      at: w.createdAt,
      type: "work",
      title: `Work added: ${w.title ?? "untitled"}`,
      detail: `${w.workType} · ${w.source}`,
    });
  }

  // Published reports.
  const reports = await db
    .select({ period: s.progressReports.period, publishedAt: s.progressReports.publishedAt })
    .from(s.progressReports)
    .where(and(eq(s.progressReports.studentId, studentId), eq(s.progressReports.status, "published")));
  for (const r of reports) {
    if (r.publishedAt) events.push({ at: r.publishedAt, type: "report", title: `Progress report published: ${r.period}` });
  }

  if (audience === "staff") {
    // Teacher-approved observations only — never raw/unverified ones.
    const obs = await db
      .select({ category: s.observations.category, statement: s.observations.statement, status: s.observations.status, createdAt: s.observations.createdAt })
      .from(s.observations)
      .where(and(eq(s.observations.studentId, studentId), inArray(s.observations.status, ["approved", "partially_approved"])));
    for (const o of obs) {
      events.push({ at: o.createdAt, type: "observation", title: `Observation approved (${o.category})`, detail: o.statement });
    }

    const forms = await db
      .select({ formType: s.formSubmissions.formType, submittedAt: s.formSubmissions.submittedAt })
      .from(s.formSubmissions)
      .where(eq(s.formSubmissions.studentId, studentId));
    for (const f of forms) {
      events.push({ at: f.submittedAt, type: "form", title: `${f.formType.replace(/_/g, " ")} submitted` });
    }

    const materials = await db
      .select({ title: s.teachingMaterials.title, createdAt: s.teachingMaterials.createdAt, dueDate: s.teachingMaterials.dueDate })
      .from(s.teachingMaterials)
      .where(eq(s.teachingMaterials.studentId, studentId));
    for (const m of materials) {
      events.push({
        at: m.createdAt,
        type: "material",
        title: `Material assigned: ${m.title}`,
        detail: m.dueDate ? `due ${m.dueDate}` : null,
      });
    }
  }

  const filtered = audience === "parent" ? events.filter((e) => PARENT_TYPES.has(e.type)) : events;
  return filtered.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
