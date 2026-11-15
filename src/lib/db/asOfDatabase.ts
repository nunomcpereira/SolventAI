import { openDatabase, type Database } from "./client.js";
import { type EntityType } from "../../domain/history/entityHistory.js";
import { reconstructAsOf } from "../services/historyReplay.js";
import { createSqliteEntityHistoryRepository } from "./repositories/sqliteEntityHistoryRepository.js";
import { createSqliteAccountRepository } from "./repositories/sqliteAccountRepository.js";
import { createSqliteLoanRepository } from "./repositories/sqliteLoanRepository.js";
import { createSqliteIncomeRepository } from "./repositories/sqliteIncomeRepository.js";
import { createSqliteExpenseRepository } from "./repositories/sqliteExpenseRepository.js";
import { createSqliteRecurringTransferRepository } from "./repositories/sqliteRecurringTransferRepository.js";
import { createSqliteScenarioRepository } from "./repositories/sqliteScenarioRepository.js";
import { createSqliteSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { parseAccount } from "../../domain/accounts/account.js";
import { parseLoan } from "../../domain/loans/loan.js";
import { parseIncome } from "../../domain/income/income.js";
import { parseExpense } from "../../domain/expenses/expense.js";
import { parseRecurringTransfer } from "../../domain/transfers/recurringTransfer.js";
import { parseScenario } from "../../domain/scenarios/scenario.js";
import { parseSettings } from "../../domain/settings/settings.js";

/** Tables whose rows are rebuilt from entity_history rather than copied as they are now. */
const REBUILT_TABLES = new Set(["accounts", "loans", "loan_fees", "incomes", "expenses", "recurring_transfers", "scenarios", "settings", "entity_history", "schema_migrations"]);

/** Every row is already older than the cut-off, so reconstruct "as of the end of time". */
const END_OF_TIME = "9999-12-31T23:59:59.999Z";

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Builds a read-only, in-memory copy of the database at `sourcePath` as it stood just
 * before `beforeIso`: accounts, incomes, expenses, recurring transfers, loans, scenarios and settings are each
 * entity's last history row strictly before that instant (deleted ones dropped), and
 * entity_history is cut there too. Untracked tables (exchange rates, contracts, market
 * rates…) are copied as they are now — they have no history. If no settings were recorded
 * yet, the current settings are used so pages still render.
 *
 * Data from before history tracking began only exists from its "baseline" row onwards.
 */
export async function buildAsOfDatabase(sourcePath: string, beforeIso: string): Promise<Database> {
  const db = openDatabase(":memory:");
  db.exec("PRAGMA foreign_keys = OFF;");
  db.prepare("ATTACH DATABASE ? AS src").run(sourcePath);
  try {
    const tables = db
      .prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const sourceTables = new Set(
      (db.prepare("SELECT name FROM src.sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name),
    );
    for (const { name } of tables) {
      if (REBUILT_TABLES.has(name) || !sourceTables.has(name)) continue;
      db.exec(`INSERT INTO main.${quote(name)} SELECT * FROM src.${quote(name)}`);
    }
    db.prepare("INSERT INTO main.entity_history SELECT * FROM src.entity_history WHERE recorded_at < ? ORDER BY rowid").run(beforeIso);
    // Kept aside in case history has no settings to rebuild from.
    db.exec("CREATE TEMP TABLE current_settings AS SELECT * FROM src.settings");
  } finally {
    db.exec("DETACH DATABASE src");
  }

  const history = createSqliteEntityHistoryRepository(db);
  const lastHistoryRowid = (db.prepare("SELECT COALESCE(MAX(rowid), 0) AS id FROM entity_history").get() as { id: number }).id;
  const asOf = async <T>(type: EntityType, parse: (raw: unknown) => T) =>
    [...reconstructAsOf(await history.listByType(type), END_OF_TIME, parse).values()];

  const accounts = createSqliteAccountRepository(db);
  for (const a of await asOf("account", parseAccount)) await accounts.save(a);
  const loans = createSqliteLoanRepository(db);
  for (const l of await asOf("loan", parseLoan)) await loans.save(l);
  const incomes = createSqliteIncomeRepository(db);
  for (const i of await asOf("income", parseIncome)) await incomes.save(i);
  const expenses = createSqliteExpenseRepository(db);
  for (const e of await asOf("expense", parseExpense)) await expenses.save(e);
  const transfers = createSqliteRecurringTransferRepository(db);
  for (const t of await asOf("transfer", parseRecurringTransfer)) await transfers.save(t);
  const scenarios = createSqliteScenarioRepository(db);
  for (const s of await asOf("scenario", parseScenario)) await scenarios.save(s);
  const [settings] = await asOf("settings", parseSettings);
  if (settings) await createSqliteSettingsRepository(db).save(settings);
  else db.exec("INSERT INTO main.settings SELECT * FROM temp.current_settings");
  db.exec("DROP TABLE temp.current_settings");

  // The saves above recorded "now" history rows of their own; this copy's history must end at the cut-off.
  db.prepare("DELETE FROM entity_history WHERE rowid > ?").run(lastHistoryRowid);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA query_only = ON;");
  return db;
}
