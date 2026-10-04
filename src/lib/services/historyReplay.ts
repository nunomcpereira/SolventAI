import { type EntityHistoryEntry } from "../../domain/history/entityHistory.js";

/**
 * Given every history row for one entity type, returns each entity's state as of
 * `asOfIso` (its latest row with `recordedAt <= asOfIso`; absent if that row was a
 * delete). `rows` must already be sorted ascending by `recordedAt` (as
 * `EntityHistoryRepository.listByType` returns them) — later rows for the same entity
 * simply overwrite earlier ones as we walk forward, so no explicit `Math.max` needed.
 *
 * Kept in its own module (no "server-only", no DB import) purely so it can be unit
 * tested directly — historyReplayService.ts, which does the DB I/O, re-exports it.
 */
export function reconstructAsOf<T>(
  rows: readonly EntityHistoryEntry[],
  asOfIso: string,
  parse: (raw: unknown) => T,
): Map<string, T> {
  const latestByEntity = new Map<string, EntityHistoryEntry>();
  for (const row of rows) {
    if (row.recordedAt > asOfIso) break;
    latestByEntity.set(row.entityId, row);
  }
  const result = new Map<string, T>();
  for (const [entityId, row] of latestByEntity) {
    if (row.changeType === "delete") continue;
    result.set(entityId, parse(row.snapshot));
  }
  return result;
}
