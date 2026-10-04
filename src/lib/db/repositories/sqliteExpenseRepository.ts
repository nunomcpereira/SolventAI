import { type Database } from "../client.js";
import { type Expense, type ExpenseRepository, parseExpense, serializeExpense } from "../../../domain/expenses/expense.js";
import { createSqliteRecurringItemRepository } from "./sqliteRecurringItemRepository.js";

export function createSqliteExpenseRepository(db: Database): ExpenseRepository {
  return createSqliteRecurringItemRepository<Expense, Expense["category"]>(
    db,
    "expenses",
    parseExpense,
    serializeExpense,
  );
}
