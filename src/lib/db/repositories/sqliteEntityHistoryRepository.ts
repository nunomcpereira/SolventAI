import { randomUUID } from "node:crypto";
import { type Database } from "../client.js";
import { type EntityType, type ChangeType, type EntityHistoryEntry } from "../../../domain/history/entityHistory.js";

interface EntityHistoryRow {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  recorded_at: string;
  snapshot_json: string;
}

function rowToEntry(row: EntityHistoryRow): EntityHistoryEntry {
  return {
    id: row.id,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    changeType: row.change_type as ChangeType,
    recordedAt: row.recorded_at,
    snapshot: JSON.parse(row.snapshot_json) as unknown,
  };
}

export interface EntityHistoryRepository {
  /** Appends one audit row. Called by each mutating repository's own save()/delete(),
   * inside the same transaction as the mutation it's recording. */
  record(entry: { entityType: EntityType; entityId: string; changeType: ChangeType; snapshot: unknown }): void;
  listByType(entityType: EntityType): Promise<EntityHistoryEntry[]>;
  /** Every row, oldest first (insertion order breaks timestamp ties). Feeds the audit log. */
  listAll(): Promise<EntityHistoryEntry[]>;
}

/**
 * Synchronous `record()` (not async, unlike the rest of this codebase's repositories) —
 * it must run inline inside a caller's already-open `db.exec("BEGIN")`/`COMMIT`
 * transaction (node:sqlite's DatabaseSync is itself synchronous), so an async signature
 * here would just be misleading busy-work, not real concurrency.
 */
export function createSqliteEntityHistoryRepository(db: Database): EntityHistoryRepository {
  return {
    record({ entityType, entityId, changeType, snapshot }): void {
      db.prepare(
        `INSERT INTO entity_history (id, entity_type, entity_id, change_type, recorded_at, snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), entityType, entityId, changeType, new Date().toISOString(), JSON.stringify(snapshot));
    },

    async listByType(entityType: EntityType): Promise<EntityHistoryEntry[]> {
      const rows = db
        .prepare("SELECT * FROM entity_history WHERE entity_type = ? ORDER BY recorded_at ASC")
        .all(entityType) as unknown as EntityHistoryRow[];
      return rows.map(rowToEntry);
    },

    async listAll(): Promise<EntityHistoryEntry[]> {
      const rows = db
        .prepare("SELECT * FROM entity_history ORDER BY recorded_at ASC, rowid ASC")
        .all() as unknown as EntityHistoryRow[];
      return rows.map(rowToEntry);
    },
  };
}
