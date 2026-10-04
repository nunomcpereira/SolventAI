import "server-only";
import { randomUUID } from "node:crypto";
import { parseIncome, type Income, type IncomeCategory } from "../../domain/income/income.js";
import { parseExpense, type Expense, type ExpenseCategory } from "../../domain/expenses/expense.js";
import { Money } from "../../engine/money/money.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { getDb } from "./db.js";
import { createSqliteExpenseRepository, createSqliteIncomeRepository } from "../db/repositories/index.js";

export interface RecurringIncomeInput {
  accountId: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  category: IncomeCategory;
}

export interface RecurringExpenseInput {
  accountId: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  category: ExpenseCategory;
}

function normalizeDecimalInput(value: string): string {
  return value.replace(/\s+/g, "").replace(",", ".");
}

/** Shared shape behind both income and expense create/update — same field mapping,
 * only the id source (new vs existing) and the domain parser differ per caller. */
function buildRecurringEntryFields<Category extends string>(
  id: string,
  input: { accountId: string; amount: string; currency: string; frequency: Frequency; startDate: string; endDate?: string; category: Category },
) {
  const normalizedAmount = normalizeDecimalInput(input.amount || "0");
  return {
    id,
    accountId: input.accountId,
    amount: {
      minorUnits: Money.fromDecimalString(normalizedAmount, input.currency).minorUnits.toString(),
      currency: input.currency,
    },
    frequency: input.frequency,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    category: input.category,
  };
}

export async function listRecurringIncomes(): Promise<Income[]> {
  const db = await getDb();
  return createSqliteIncomeRepository(db).list();
}

export async function deleteRecurringIncome(id: string): Promise<void> {
  const db = await getDb();
  await createSqliteIncomeRepository(db).delete(id);
}

export async function listRecurringExpenses(): Promise<Expense[]> {
  const db = await getDb();
  return createSqliteExpenseRepository(db).list();
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const db = await getDb();
  await createSqliteExpenseRepository(db).delete(id);
}

export async function createRecurringIncome(input: RecurringIncomeInput): Promise<Income> {
  const db = await getDb();
  const repo = createSqliteIncomeRepository(db);
  const income = parseIncome(buildRecurringEntryFields(randomUUID(), input));
  await repo.save(income);
  return income;
}

export async function updateRecurringIncome(id: string, input: RecurringIncomeInput): Promise<Income> {
  const db = await getDb();
  const repo = createSqliteIncomeRepository(db);
  const income = parseIncome(buildRecurringEntryFields(id, input));
  await repo.save(income);
  return income;
}

export async function createRecurringExpense(input: RecurringExpenseInput): Promise<Expense> {
  const db = await getDb();
  const repo = createSqliteExpenseRepository(db);
  const expense = parseExpense(buildRecurringEntryFields(randomUUID(), input));
  await repo.save(expense);
  return expense;
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput): Promise<Expense> {
  const db = await getDb();
  const repo = createSqliteExpenseRepository(db);
  const expense = parseExpense(buildRecurringEntryFields(id, input));
  await repo.save(expense);
  return expense;
}
