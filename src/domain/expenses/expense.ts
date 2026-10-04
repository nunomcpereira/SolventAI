import { z } from "zod";
import {
  recurringItemInputSchema,
  parseRecurringItemFields,
  serializeRecurringItemFields,
  type RecurringItemBase,
  type SerializedRecurringItemBase,
} from "../shared/recurringItem.js";
import { DomainValidationError, type Repository } from "../shared/index.js";

export const EXPENSE_CATEGORIES = [
  "housing",
  "utilities",
  "food",
  "transport",
  "insurance",
  "healthcare",
  "government",
  "subscriptions",
  "discretionary",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = RecurringItemBase<ExpenseCategory>;
export type SerializedExpense = SerializedRecurringItemBase<ExpenseCategory>;

export interface ExpenseRepository extends Repository<Expense> {}

export const expenseInputSchema = recurringItemInputSchema(EXPENSE_CATEGORIES);
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export function parseExpense(raw: unknown): Expense {
  const result = expenseInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("Expense", result.error);
  }
  const input = result.data;
  const expense = parseRecurringItemFields(input);

  if (!expense.amount.isPositive()) {
    throw new DomainValidationError(
      "Expense",
      new z.ZodError([{ code: "custom", path: ["amount"], message: "must be positive" }]),
    );
  }
  if (expense.endDate !== undefined && expense.endDate.isBefore(expense.startDate)) {
    throw new DomainValidationError(
      "Expense",
      new z.ZodError([{ code: "custom", path: ["endDate"], message: "must not be before startDate" }]),
    );
  }

  return expense;
}

export function serializeExpense(expense: Expense): SerializedExpense {
  return serializeRecurringItemFields(expense);
}
