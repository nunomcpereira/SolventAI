import { type Database } from "../client.js";
import {
  type RecurringTransfer,
  type RecurringTransferRepository,
  type SerializedRecurringTransfer,
  parseRecurringTransfer,
  serializeRecurringTransfer,
} from "../../../domain/transfers/recurringTransfer.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";

interface RecurringTransferRow {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor_units: string;
  currency: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
}

function rowToSerialized(row: RecurringTransferRow): SerializedRecurringTransfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amount: { minorUnits: row.amount_minor_units, currency: row.currency },
    frequency: row.frequency as SerializedRecurringTransfer["frequency"],
    startDate: row.start_date,
    ...(row.end_date !== null ? { endDate: row.end_date } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
  };
}

export function createSqliteRecurringTransferRepository(db: Database): RecurringTransferRepository {
  const history = createSqliteEntityHistoryRepository(db);

  return {
    async findById(id: string): Promise<RecurringTransfer | undefined> {
      const row = db.prepare("SELECT * FROM recurring_transfers WHERE id = ?").get(id) as RecurringTransferRow | undefined;
      return row ? parseRecurringTransfer(rowToSerialized(row)) : undefined;
    },

    async list(): Promise<RecurringTransfer[]> {
      const rows = db.prepare("SELECT * FROM recurring_transfers ORDER BY start_date, id").all() as unknown as RecurringTransferRow[];
      return rows.map((row) => parseRecurringTransfer(rowToSerialized(row)));
    },

    async save(transfer: RecurringTransfer): Promise<void> {
      const s = serializeRecurringTransfer(transfer);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO recurring_transfers (id, from_account_id, to_account_id, amount_minor_units, currency, frequency, start_date, end_date, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             from_account_id = excluded.from_account_id,
             to_account_id = excluded.to_account_id,
             amount_minor_units = excluded.amount_minor_units,
             currency = excluded.currency,
             frequency = excluded.frequency,
             start_date = excluded.start_date,
             end_date = excluded.end_date,
             description = excluded.description`,
        ).run(
          s.id,
          s.fromAccountId,
          s.toAccountId,
          s.amount.minorUnits,
          s.amount.currency,
          s.frequency,
          s.startDate,
          s.endDate ?? null,
          s.description ?? null,
        );
        history.record({ entityType: "transfer", entityId: s.id, changeType: "save", snapshot: s });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        const row = db.prepare("SELECT * FROM recurring_transfers WHERE id = ?").get(id) as RecurringTransferRow | undefined;
        db.prepare("DELETE FROM recurring_transfers WHERE id = ?").run(id);
        if (row) history.record({ entityType: "transfer", entityId: id, changeType: "delete", snapshot: rowToSerialized(row) });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
