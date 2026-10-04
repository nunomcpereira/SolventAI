import { type Database } from "../client.js";
import {
  type Account,
  type AccountRepository,
  type SerializedAccount,
  parseAccount,
  serializeAccount,
} from "../../../domain/accounts/account.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";

interface AccountRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance_minor_units: string;
  minimum_reserve_minor_units: string;
  active: number;
  is_default: number;
}

function rowToAccount(row: AccountRow): Account {
  const serialized: SerializedAccount = {
    id: row.id,
    name: row.name,
    type: row.type as SerializedAccount["type"],
    currency: row.currency,
    initialBalance: { minorUnits: row.initial_balance_minor_units, currency: row.currency },
    minimumReserve: { minorUnits: row.minimum_reserve_minor_units, currency: row.currency },
    active: row.active === 1,
    isDefault: row.is_default === 1,
  };
  return parseAccount(serialized);
}

export function createSqliteAccountRepository(db: Database): AccountRepository {
  const history = createSqliteEntityHistoryRepository(db);

  return {
    async findById(id: string): Promise<Account | undefined> {
      const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined;
      return row ? rowToAccount(row) : undefined;
    },

    async list(): Promise<Account[]> {
      const rows = db.prepare("SELECT * FROM accounts ORDER BY is_default DESC, name").all() as unknown as AccountRow[];
      return rows.map(rowToAccount);
    },

    async save(account: Account): Promise<void> {
      const s = serializeAccount(account);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO accounts (id, name, type, currency, initial_balance_minor_units, minimum_reserve_minor_units, active, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             type = excluded.type,
             currency = excluded.currency,
             initial_balance_minor_units = excluded.initial_balance_minor_units,
             minimum_reserve_minor_units = excluded.minimum_reserve_minor_units,
             active = excluded.active,
             is_default = excluded.is_default`,
        ).run(
          s.id,
          s.name,
          s.type,
          s.currency,
          s.initialBalance.minorUnits,
          s.minimumReserve.minorUnits,
          s.active ? 1 : 0,
          s.isDefault ? 1 : 0,
        );
        history.record({ entityType: "account", entityId: s.id, changeType: "save", snapshot: s });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined;
        db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
        if (row) {
          history.record({
            entityType: "account",
            entityId: id,
            changeType: "delete",
            snapshot: serializeAccount(rowToAccount(row)),
          });
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async setDefault(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        db.prepare("UPDATE accounts SET is_default = 0 WHERE is_default = 1").run();
        db.prepare("UPDATE accounts SET is_default = 1 WHERE id = ?").run(id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
