import { type Database } from "./client.js";
import { type EntityType } from "../../domain/history/entityHistory.js";
import { createSqliteAccountRepository } from "./repositories/sqliteAccountRepository.js";
import { createSqliteLoanRepository } from "./repositories/sqliteLoanRepository.js";
import { createSqliteIncomeRepository } from "./repositories/sqliteIncomeRepository.js";
import { createSqliteExpenseRepository } from "./repositories/sqliteExpenseRepository.js";
import { createSqliteScenarioRepository } from "./repositories/sqliteScenarioRepository.js";
import { createSqliteSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { createSqliteContractDocumentRepository } from "./repositories/sqliteContractRepository.js";
import { parseAccount } from "../../domain/accounts/account.js";
import { parseLoan } from "../../domain/loans/loan.js";
import { parseIncome } from "../../domain/income/income.js";
import { parseExpense } from "../../domain/expenses/expense.js";
import { parseScenario } from "../../domain/scenarios/scenario.js";
import { parseSettings } from "../../domain/settings/settings.js";

/**
 * Saves a history snapshot back as the entity's current state, through the normal
 * repository save (so the restore is itself recorded in the audit log). Two things are
 * not taken from the snapshot because they depend on the rest of today's data:
 * - an account's "default" flag stays as it is now (false if the account is recreated),
 *   so there is never more than one default account;
 * - a loan's contract document link is dropped if that document no longer exists.
 */
export async function restoreSnapshot(db: Database, entityType: EntityType, snapshot: unknown): Promise<void> {
  switch (entityType) {
    case "account": {
      const repo = createSqliteAccountRepository(db);
      const account = parseAccount(snapshot);
      const current = await repo.findById(account.id);
      await repo.save({ ...account, isDefault: current?.isDefault ?? false });
      return;
    }
    case "loan": {
      const loan = parseLoan(snapshot);
      const docId = loan.contractDocumentId;
      if (docId && !(await createSqliteContractDocumentRepository(db).findById(docId))) delete loan.contractDocumentId;
      await createSqliteLoanRepository(db).save(loan);
      return;
    }
    case "income":
      await createSqliteIncomeRepository(db).save(parseIncome(snapshot));
      return;
    case "expense":
      await createSqliteExpenseRepository(db).save(parseExpense(snapshot));
      return;
    case "scenario":
      await createSqliteScenarioRepository(db).save(parseScenario(snapshot));
      return;
    case "settings":
      await createSqliteSettingsRepository(db).save(parseSettings(snapshot));
      return;
  }
}
