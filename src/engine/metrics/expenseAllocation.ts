import { Money } from "../money/money.js";
import { type IsoDate } from "../dates/isoDate.js";
import { type Frequency, PERIODS_PER_YEAR } from "../dates/frequency.js";

/**
 * How recurring expenses split per month, by category. Every item is normalized to a
 * monthly equivalent (amount × periods per year ÷ 12), so a yearly insurance premium
 * counts as 1/12 of itself each month — the "average month", not any one calendar month.
 * Items that already ended, haven't started yet, or are one-offs (start = end) are left out.
 */

export interface AllocationItem {
  category: string;
  amount: Money;
  frequency: Frequency;
  startDate: IsoDate;
  endDate?: IsoDate;
}

export interface CategoryAllocation {
  category: string;
  monthly: Money;
  /** Share of the total, 0..1. */
  share: number;
  itemCount: number;
}

export interface ExpenseAllocation {
  totalMonthly: Money;
  categories: CategoryAllocation[];
  itemCount: number;
}

export function monthlyEquivalent(amount: Money, frequency: Frequency): Money {
  return amount.mulFraction(BigInt(PERIODS_PER_YEAR[frequency]), 12n);
}

/** `items` must already be in `currency`. Categories come out largest first. */
export function computeExpenseAllocation(items: readonly AllocationItem[], currency: string, asOf: IsoDate): ExpenseAllocation {
  const active = items.filter(
    (i) =>
      !i.startDate.isAfter(asOf) &&
      (i.endDate === undefined || (!i.endDate.isBefore(asOf) && !i.endDate.equals(i.startDate))),
  );
  const byCategory = new Map<string, { monthly: Money; itemCount: number }>();
  for (const item of active) {
    if (item.amount.currency !== currency) throw new Error(`computeExpenseAllocation: ${item.amount.currency} item in a ${currency} allocation`);
    const entry = byCategory.get(item.category) ?? { monthly: Money.zero(currency), itemCount: 0 };
    entry.monthly = entry.monthly.add(monthlyEquivalent(item.amount, item.frequency));
    entry.itemCount++;
    byCategory.set(item.category, entry);
  }
  const totalMonthly = [...byCategory.values()].reduce((acc, e) => acc.add(e.monthly), Money.zero(currency));
  const total = Number(totalMonthly.toDecimalString());
  const categories = [...byCategory.entries()]
    .map(([category, e]) => ({
      category,
      monthly: e.monthly,
      share: total > 0 ? Number(e.monthly.toDecimalString()) / total : 0,
      itemCount: e.itemCount,
    }))
    .sort((a, b) => b.monthly.compare(a.monthly) || a.category.localeCompare(b.category));
  return { totalMonthly, categories, itemCount: active.length };
}
