import "server-only";
import { getDb, getDbBefore, withDb } from "./db.js";
import { getDashboardData } from "./dashboardService.js";
import { type ImpactMetrics } from "../audit/impact.js";
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

/** The dashboard's headline figures, computed against whatever getDb() returns. */
async function currentMetrics(): Promise<ImpactMetrics> {
  const d = await getDashboardData();
  return {
    totalLiquidity: d.totalLiquidity,
    availableLiquidity: d.availableLiquidity,
    monthlyDebtObligations: d.monthlyDebtObligations,
    netMonthlyIncome: d.netMonthlyIncome,
    effortRatePercent: d.effortRatePercent,
    projectedMinimumLiquidity: d.projectedMinimumLiquidity,
    debtOutstanding: d.debtOutstanding,
    liquidityRunwayMonths: d.liquidityRunwayMonths,
  };
}

/**
 * What one change did to the headline figures: the dashboard computed (as of today) on the
 * data just before the change and on the data just after it — so later changes don't blur
 * this one's effect. Undefined if the event doesn't exist.
 */
export async function getAuditImpact(eventId: string): Promise<{ before: ImpactMetrics; after: ImpactMetrics } | undefined> {
  const db = await getDb();
  const rows = await createSqliteEntityHistoryRepository(db).listAll();
  const event = buildAuditEvents(rows).find((e) => e.id === eventId);
  if (!event) return undefined;
  const justAfter = new Date(Date.parse(event.recordedAt) + 1).toISOString();
  const [beforeDb, afterDb] = await Promise.all([getDbBefore(event.recordedAt), getDbBefore(justAfter)]);
  // Both as of the moment of the change, so only the change itself differs.
  const at = new Date(event.recordedAt);
  const before = await withDb(beforeDb, at, currentMetrics);
  const after = await withDb(afterDb, at, currentMetrics);
  return { before, after };
}
