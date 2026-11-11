import "server-only";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import { createSqliteEntityHistoryRepository } from "../db/repositories/index.js";
import { buildAuditEvents, restorableSnapshot, type AuditEvent } from "../audit/auditLog.js";
import { restoreSnapshot } from "../db/restoreSnapshot.js";
import { type AuditNames } from "../audit/formatAudit.js";
import { ENTITY_TYPES, type EntityType } from "../../domain/history/entityHistory.js";

export interface AuditLogPage {
  events: AuditEvent[];
  /** Total events matching the filter (events holds at most `limit`). */
  total: number;
  names: AuditNames;
}

export function parseAuditType(value: string | undefined): EntityType | undefined {
  return (ENTITY_TYPES as readonly string[]).includes(value ?? "") ? (value as EntityType) : undefined;
}

/**
 * Audit events, newest first, optionally for one entity type. Names come from every
 * snapshot ever recorded, so a deleted account or loan is still shown by name.
 */
export async function getAuditLog(params: { type?: EntityType; limit: number }): Promise<AuditLogPage> {
  const db = await getDb();
  await ensureSeeded(db);
  const rows = await createSqliteEntityHistoryRepository(db).listAll();

  const accounts = new Map<string, string>();
  const loans = new Map<string, string>();
  for (const row of rows) {
    const name = (row.snapshot as { name?: unknown } | null)?.name;
    if (typeof name !== "string") continue;
    if (row.entityType === "account") accounts.set(row.entityId, name);
    if (row.entityType === "loan") loans.set(row.entityId, name);
  }

  const all = buildAuditEvents(rows).filter((e) => !params.type || e.entityType === params.type);
  return { events: all.slice(0, params.limit), total: all.length, names: { accounts, loans } };
}

/**
 * Restores the version of an entity from just before audit event `eventId` (an update's
 * previous state, or a deleted item's last state). Returns the restored entity's type, or
 * undefined when the event doesn't exist or can't be restored (a creation).
 */
export async function restoreAuditVersion(eventId: string): Promise<EntityType | undefined> {
  const db = await getDb();
  const rows = await createSqliteEntityHistoryRepository(db).listAll();
  const event = buildAuditEvents(rows).find((e) => e.id === eventId);
  const snapshot = event ? restorableSnapshot(event) : undefined;
  if (!event || snapshot === undefined) return undefined;
  await restoreSnapshot(db, event.entityType, snapshot);
  return event.entityType;
}
