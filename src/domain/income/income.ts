import { z } from "zod";
import {
  recurringItemInputSchema,
  parseRecurringItemFields,
  serializeRecurringItemFields,
  type RecurringItemBase,
  type SerializedRecurringItemBase,
} from "../shared/recurringItem.js";
import { DomainValidationError, type Repository } from "../shared/index.js";

export const INCOME_CATEGORIES = ["salary", "rent", "bonus", "pension", "freelance", "investment", "government", "other"] as const;
export type IncomeCategory = string;

export type Income = RecurringItemBase<IncomeCategory>;
export type SerializedIncome = SerializedRecurringItemBase<IncomeCategory>;

export interface IncomeRepository extends Repository<Income> {}

export const incomeInputSchema = recurringItemInputSchema(["other"] as const).extend({
  category: z.string().trim().min(1),
});
export type IncomeInput = z.infer<typeof incomeInputSchema>;

export function parseIncome(raw: unknown): Income {
  const result = incomeInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("Income", result.error);
  }
  const input = result.data;
  const income = parseRecurringItemFields(input);

  if (!income.amount.isPositive()) {
    throw new DomainValidationError(
      "Income",
      new z.ZodError([{ code: "custom", path: ["amount"], message: "must be positive" }]),
    );
  }
  if (income.endDate !== undefined && income.endDate.isBefore(income.startDate)) {
    throw new DomainValidationError(
      "Income",
      new z.ZodError([{ code: "custom", path: ["endDate"], message: "must not be before startDate" }]),
    );
  }

  return income;
}

export function serializeIncome(income: Income): SerializedIncome {
  return serializeRecurringItemFields(income);
}
