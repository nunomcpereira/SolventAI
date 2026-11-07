import { Decimal } from "../money/decimal.js";
import { type Rate } from "../rates/rate.js";

/**
 * The annual rate a loan is charging right now, given how many periods have already been
 * paid. Unlike resolveEffectiveRate (which answers "what rate applies on this date" from a
 * fixing timeline), this needs no fixings: variable legs use the loan's latest known index
 * value. A mixed loan charges its fixed rate until `fixedPeriodCount` periods have elapsed,
 * then index + spread.
 */
export function currentAnnualRate(rate: Rate, periodsElapsed: number): Decimal {
  if (rate.type === "fixed") return rate.annualRate;
  if (rate.type === "mixed" && periodsElapsed < rate.fixedPeriodCount) return rate.fixedAnnualRate;
  let effective = rate.currentIndexRate.add(rate.spread);
  if (rate.rateCap !== undefined) effective = effective.min(rate.rateCap);
  if (rate.rateFloor !== undefined) effective = effective.max(rate.rateFloor);
  return effective;
}

/**
 * Balance-weighted average rate: sum(balance_i * rate_i) / sum(balance_i). Weighting by what
 * is still owed (not the original principal) makes a nearly-repaid loan count for little.
 * Returns undefined when there is nothing outstanding.
 */
export function weightedAverageRate(items: readonly { balanceMinorUnits: bigint; annualRate: Decimal }[]): Decimal | undefined {
  const positive = items.filter((item) => item.balanceMinorUnits > 0n);
  const total = positive.reduce((sum, item) => sum + item.balanceMinorUnits, 0n);
  if (total === 0n) return undefined;
  const numerator = positive.reduce(
    (sum, item) => sum.add(Decimal.fromBigInt(item.balanceMinorUnits).mul(item.annualRate)),
    Decimal.ZERO,
  );
  return numerator.div(Decimal.fromBigInt(total));
}
