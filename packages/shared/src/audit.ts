import { schema as s, type Db } from "@platform/db";

export interface AuditEntry {
  actorType: "user" | "ai_agent" | "system";
  /** users.id when actorType='user'; null for ai_agent/system. */
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /**
   * Sparse details only — the field and its old/new values, never a copy of
   * the whole row (the audit log must not become a second database).
   */
  details?: Record<string, unknown>;
}

/** Accepts the db or a transaction — audit rows written inside a transaction
 *  must still go through this choke point, never a raw insert. */
type AuditWriter = Pick<Db, "insert">;

export async function writeAudit(db: AuditWriter, entry: AuditEntry): Promise<void> {
  await db.insert(s.auditLog).values({
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? null,
  });
}
