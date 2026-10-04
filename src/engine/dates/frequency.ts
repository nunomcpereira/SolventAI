import { IsoDate } from "./isoDate.js";

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";

/** Number of periods per calendar year, used for rate conversions (e.g. annual rate -> per-period rate). */
export const PERIODS_PER_YEAR: Readonly<Record<Frequency, number>> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

/** Advances `date` by one period of `frequency`. */
export function stepDate(date: IsoDate, frequency: Frequency): IsoDate {
  switch (frequency) {
    case "daily":
      return date.addDays(1);
    case "weekly":
      return date.addDays(7);
    case "biweekly":
      return date.addDays(14);
    case "monthly":
      return date.addMonths(1);
    case "quarterly":
      return date.addMonths(3);
    case "semiannual":
      return date.addMonths(6);
    case "annual":
      return date.addMonths(12);
    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${String(exhaustive)}`);
    }
  }
}

/**
 * Generates `count` successive period-end dates starting from `startDate` (exclusive),
 * stepping by `frequency`. Deterministic: same inputs always produce the same dates.
 * E.g. startDate=2026-01-15, monthly, count=3 -> [2026-02-15, 2026-03-15, 2026-04-15].
 */
export function generatePeriodDates(startDate: IsoDate, frequency: Frequency, count: number): IsoDate[] {
  if (count < 0 || !Number.isInteger(count)) {
    throw new Error("generatePeriodDates: count must be a non-negative integer");
  }
  const dates: IsoDate[] = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    current = stepDate(current, frequency);
    dates.push(current);
  }
  return dates;
}

/**
 * Counts how many full periods of `frequency` fit between `startDate` (exclusive) and
 * `endDate` (inclusive), by walking forward — consistent with generatePeriodDates.
 */
export function countPeriodsBetween(startDate: IsoDate, endDate: IsoDate, frequency: Frequency): number {
  if (endDate.isBefore(startDate)) {
    throw new Error("countPeriodsBetween: endDate must not be before startDate");
  }
  let current = startDate;
  let count = 0;
  while (current.isBefore(endDate)) {
    current = stepDate(current, frequency);
    count++;
    if (count > 100_000) throw new Error("countPeriodsBetween: exceeded safety limit");
  }
  return count;
}
