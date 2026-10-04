import { z } from "zod";
import { Money } from "../../engine/money/money.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { type InflationRule } from "../../engine/simulation/recurringSchedule.js";
import {
  moneySchema,
  moneyToSerialized,
  moneyFromSerialized,
  isoDateSchema,
  isoDateToSerialized,
  isoDateFromSerialized,
  decimalSchema,
  decimalToSerialized,
  decimalFromSerialized,
  type SerializedMoney,
  type SerializedIsoDate,
} from "./codecs.js";

/**
 * Shared shape for recurring income/expense items (spec sections 13-14). Only the
 * category enum differs between Income and Expense, so both build on this factory
 * rather than duplicating the amount/frequency/dates/inflation plumbing.
 */

export type { InflationRule } from "../../engine/simulation/recurringSchedule.js";

const frequencySchema = z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"]);

const serializedInflationRuleSchema = z.object({
  type: z.enum(["annual", "monthly_compounded"]),
  rate: decimalSchema,
});
export type SerializedInflationRule = z.infer<typeof serializedInflationRuleSchema>;

export function inflationRuleFromSerialized(value: SerializedInflationRule): InflationRule {
  return { type: value.type, rate: decimalFromSerialized(value.rate) };
}

export function inflationRuleToSerialized(rule: InflationRule): SerializedInflationRule {
  return { type: rule.type, rate: decimalToSerialized(rule.rate) };
}

export function recurringItemInputSchema<Category extends string>(categories: readonly [Category, ...Category[]]) {
  return z.object({
    id: z.string().min(1),
    accountId: z.string().min(1),
    amount: moneySchema,
    frequency: frequencySchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
    category: z.enum(categories as [Category, ...Category[]]),
    inflationRule: serializedInflationRuleSchema.optional(),
  });
}

export interface RecurringItemBase<Category extends string> {
  id: string;
  accountId: string;
  amount: Money;
  frequency: Frequency;
  startDate: IsoDate;
  endDate?: IsoDate;
  category: Category;
  inflationRule?: InflationRule;
}

export interface SerializedRecurringItemBase<Category extends string> {
  id: string;
  accountId: string;
  amount: SerializedMoney;
  frequency: Frequency;
  startDate: SerializedIsoDate;
  endDate?: SerializedIsoDate;
  category: Category;
  inflationRule?: SerializedInflationRule;
}

export function parseRecurringItemFields<Category extends string>(input: {
  id: string;
  accountId: string;
  amount: { minorUnits: string; currency: string };
  frequency: Frequency;
  startDate: string;
  endDate?: string | undefined;
  category: Category;
  inflationRule?: SerializedInflationRule | undefined;
}): RecurringItemBase<Category> {
  return {
    id: input.id,
    accountId: input.accountId,
    amount: moneyFromSerialized(input.amount),
    frequency: input.frequency,
    startDate: isoDateFromSerialized(input.startDate),
    ...(input.endDate !== undefined ? { endDate: isoDateFromSerialized(input.endDate) } : {}),
    category: input.category,
    ...(input.inflationRule !== undefined ? { inflationRule: inflationRuleFromSerialized(input.inflationRule) } : {}),
  };
}

export function serializeRecurringItemFields<Category extends string>(
  item: RecurringItemBase<Category>,
): SerializedRecurringItemBase<Category> {
  return {
    id: item.id,
    accountId: item.accountId,
    amount: moneyToSerialized(item.amount),
    frequency: item.frequency,
    startDate: isoDateToSerialized(item.startDate),
    ...(item.endDate !== undefined ? { endDate: isoDateToSerialized(item.endDate) } : {}),
    category: item.category,
    ...(item.inflationRule !== undefined ? { inflationRule: inflationRuleToSerialized(item.inflationRule) } : {}),
  };
}
