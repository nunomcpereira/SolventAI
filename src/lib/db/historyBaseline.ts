import { type Database } from "./client.js";
import { type EntityType } from "../../domain/history/entityHistory.js";
import { createSqliteEntityHistoryRepository } from "./repositories/sqliteEntityHistoryRepository.js";
import { createSqliteAccountRepository } from "./repositories/sqliteAccountRepository.js";
import { createSqliteLoanRepository } from "./repositories/sqliteLoanRepository.js";
import { createSqliteIncomeRepository } from "./repositories/sqliteIncomeRepository.js";
import { createSqliteExpenseRepository } from "./repositories/sqliteExpenseRepository.js";
import { createSqliteScenarioRepository } from "./repositories/sqliteScenarioRepository.js";
import { createSqliteSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { serializeAccount } from "../../domain/accounts/account.js";
import { serializeLoan } from "../../domain/loans/loan.js";
import { serializeIncome } from "../../domain/income/income.js";
import { serializeExpense } from "../../domain/expenses/expense.js";
import { serializeScenario } from "../../domain/scenarios/scenario.js";
import { serializeSettings } from "../../domain/settings/settings.js";

/**
 * Records a "baseline" history row for every existing entity that has no history yet —
 * data created before history existed (or before scenarios/settings were tracked). Without
 * it, the first real edit of such an entity would have nothing to diff against: the audit
 * log would show it as "created" and the previous value would be lost.
 *
 * Baselines are not events themselves; they only give later changes a "before". Idempotent:
 * once an entity has any row, it is skipped.
 */
export async function ensureHistoryBaselines(db: Database): Promise<number> {
  const history = createSqliteEntityHistoryRepository(db);
  const hasHistory = db.prepare("SELECT 1 FROM entity_history WHERE entity_type = ? AND entity_id = ? LIMIT 1");
  let recorded = 0;

  const baseline = (entityType: EntityType, entityId: string, snapshot: unknown) => {
    if (hasHistory.get(entityType, entityId) !== undefined) return;
    history.record({ entityType, entityId, changeType: "baseline", snapshot });
    recorded += 1;
  };

  const [accounts, loans, incomes, expenses, scenarios, settings] = await Promise.all([
    createSqliteAccountRepository(db).list(),
    createSqliteLoanRepository(db).list(),
    createSqliteIncomeRepository(db).list(),
    createSqliteExpenseRepository(db).list(),
    createSqliteScenarioRepository(db).list(),
    createSqliteSettingsRepository(db).get(),
  ]);

  db.exec("BEGIN");
  try {
    for (const a of accounts) baseline("account", a.id, serializeAccount(a));
    for (const l of loans) baseline("loan", l.id, serializeLoan(l));
    for (const i of incomes) baseline("income", i.id, serializeIncome(i));
    for (const e of expenses) baseline("expense", e.id, serializeExpense(e));
    for (const s of scenarios) baseline("scenario", s.id, serializeScenario(s));
    if (settings) baseline("settings", "settings", serializeSettings(settings));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return recorded;
}
