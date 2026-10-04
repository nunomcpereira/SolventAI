import { type Database } from "../client.js";
import { type Income, type IncomeRepository, parseIncome, serializeIncome } from "../../../domain/income/income.js";
import { createSqliteRecurringItemRepository } from "./sqliteRecurringItemRepository.js";

export function createSqliteIncomeRepository(db: Database): IncomeRepository {
  return createSqliteRecurringItemRepository<Income, Income["category"]>(db, "incomes", parseIncome, serializeIncome);
}
