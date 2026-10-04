import { IsoDate } from "../dates/isoDate.js";
import { type Frequency, stepDate } from "../dates/frequency.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";

export type InflationRuleType = "annual" | "monthly_compounded";

export interface InflationRule {
  type: InflationRuleType;
  /** Rate per the rule's own period: an annual rate for "annual", a monthly rate for "monthly_compounded". */
  rate: Decimal;
}

export interface RecurringAmountItem {
  amount: Money;
  frequency: Frequency;
  startDate: IsoDate;
  endDate?: IsoDate;
  inflationRule?: InflationRule;
}

export interface Occurrence {
  date: IsoDate;
  amount: Money;
}

/**
 * Expands a recurring income/expense item into concrete dated occurrences within
 * [horizonStart, horizonEnd] (both inclusive). The first occurrence is `startDate`
 * itself (not one period after it — unlike engine/dates' `generatePeriodDates`, which
 * is exclusive-of-start; a recurring item's first payment IS on its start date).
 *
 * Inflation (spec section 14), applied per `inflationRule.type`:
 *  - "annual": the amount is multiplied by (1 + rate) once per full year elapsed
 *    since `startDate`, on each anniversary of `startDate` — independent of the
 *    item's own frequency (e.g. a monthly expense still only re-prices once a year).
 *  - "monthly_compounded": multiplied by (1 + rate) once per full calendar month
 *    elapsed since `startDate`, compounding every month regardless of frequency.
 * Both are computed from whole elapsed periods (floor), never fractional/prorated.
 */
export function expandOccurrences(item: RecurringAmountItem, horizonStart: IsoDate, horizonEnd: IsoDate): Occurrence[] {
  if (horizonEnd.isBefore(horizonStart)) {
    throw new Error("expandOccurrences: horizonEnd must not be before horizonStart");
  }
  const occurrences: Occurrence[] = [];
  let current = item.startDate;
  let guard = 0;

  while (current.isSameOrBefore(horizonEnd) && (item.endDate === undefined || current.isSameOrBefore(item.endDate))) {
    if (current.isSameOrAfter(horizonStart)) {
      occurrences.push({ date: current, amount: inflatedAmount(item, current) });
    }
    current = stepDate(current, item.frequency);
    guard++;
    if (guard > 1_000_000) throw new Error("expandOccurrences: exceeded safety limit");
  }

  return occurrences;
}

function inflatedAmount(item: RecurringAmountItem, asOfDate: IsoDate): Money {
  if (item.inflationRule === undefined) return item.amount;
  const elapsedPeriods =
    item.inflationRule.type === "annual"
      ? wholeMonthsBetween(item.startDate, asOfDate) / 12
      : wholeMonthsBetween(item.startDate, asOfDate);
  const periods = Math.floor(elapsedPeriods);
  if (periods <= 0) return item.amount;
  const factor = Decimal.ONE.add(item.inflationRule.rate).pow(periods);
  return item.amount.mulDecimal(factor);
}

/** Whole calendar months between two dates, floor-rounded (e.g. Jan 15 -> Mar 14 is 1 whole month). */
function wholeMonthsBetween(from: IsoDate, to: IsoDate): number {
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) months -= 1;
  return Math.max(0, months);
}
