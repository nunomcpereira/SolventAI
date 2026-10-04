import { type Database } from "../client.js";
import { type Repository } from "../../../domain/shared/repository.js";
import { type SerializedRecurringItemBase, type SerializedInflationRule } from "../../../domain/shared/recurringItem.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { type EntityType } from "../../../domain/history/entityHistory.js";

interface RecurringItemRow {
  id: string;
  account_id: string;
  amount_minor_units: string;
  currency: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  category: string;
  inflation_rule_json: string | null;
}

function rowToSerialized<Category extends string>(row: RecurringItemRow): SerializedRecurringItemBase<Category> {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: { minorUnits: row.amount_minor_units, currency: row.currency },
    frequency: row.frequency as SerializedRecurringItemBase<Category>["frequency"],
    startDate: row.start_date,
    ...(row.end_date !== null ? { endDate: row.end_date } : {}),
    category: row.category as Category,
    ...(row.inflation_rule_json !== null
      ? { inflationRule: JSON.parse(row.inflation_rule_json) as SerializedInflationRule }
      : {}),
  };
}

/**
 * Shared SQLite CRUD for Income and Expense — both are structurally identical
 * (RecurringItemBase<Category>), differing only in table name and the category enum
 * validated by the domain-layer `parse`/`serialize` functions passed in.
 */
export function createSqliteRecurringItemRepository<T, Category extends string>(
  db: Database,
  tableName: "incomes" | "expenses",
  parse: (raw: unknown) => T,
  serialize: (item: T) => SerializedRecurringItemBase<Category>,
): Repository<T> {
  const history = createSqliteEntityHistoryRepository(db);
  const entityType: EntityType = tableName === "incomes" ? "income" : "expense";

  return {
    async findById(id: string): Promise<T | undefined> {
      const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as RecurringItemRow | undefined;
      return row ? parse(rowToSerialized<Category>(row)) : undefined;
    },

    async list(): Promise<T[]> {
      const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY start_date`).all() as unknown as RecurringItemRow[];
      return rows.map((row) => parse(rowToSerialized<Category>(row)));
    },

    async save(item: T): Promise<void> {
      const s = serialize(item);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO ${tableName} (id, account_id, amount_minor_units, currency, frequency, start_date, end_date, category, inflation_rule_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             account_id = excluded.account_id,
             amount_minor_units = excluded.amount_minor_units,
             currency = excluded.currency,
             frequency = excluded.frequency,
             start_date = excluded.start_date,
             end_date = excluded.end_date,
             category = excluded.category,
             inflation_rule_json = excluded.inflation_rule_json`,
        ).run(
          s.id,
          s.accountId,
          s.amount.minorUnits,
          s.amount.currency,
          s.frequency,
          s.startDate,
          s.endDate ?? null,
          s.category,
          s.inflationRule ? JSON.stringify(s.inflationRule) : null,
        );
        history.record({ entityType, entityId: s.id, changeType: "save", snapshot: s });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as RecurringItemRow | undefined;
        db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
        if (row) {
          history.record({
            entityType,
            entityId: id,
            changeType: "delete",
            snapshot: rowToSerialized<Category>(row),
          });
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
