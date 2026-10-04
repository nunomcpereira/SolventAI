import { type Money, sumMoney } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";
import { type IsoDate } from "../dates/isoDate.js";

export interface BalanceCheckpoint {
  date: IsoDate;
  balance: Money;
}

export interface SavingsTrend {
  anchor: BalanceCheckpoint;
  /** Mean of each checkpoint interval's own savings rate, expressed per average month
   * (365.25 / 12 days) — every interval weighs equally regardless of its length. */
  averageMonthlySavings: Money;
  /** Balance the trend predicts at `date`: the anchor plus the average rate times the
   * days elapsed since it. Dates before the anchor extrapolate backwards. */
  valueAt(date: IsoDate): Money;
}

/**
 * Derives a savings trend from real balance checkpoints: each consecutive pair of
 * checkpoints is one period whose rate is (balance delta / days between), and the trend
 * is the average of those per-period rates, anchored on the latest checkpoint.
 * Returns undefined with fewer than two checkpoints on distinct dates (no period to
 * average over).
 */
export function computeSavingsTrend(currency: CurrencyCode, checkpoints: BalanceCheckpoint[]): SavingsTrend | undefined {
  const sorted = [...checkpoints].sort((a, b) => a.date.compare(b.date));
  const periods: { delta: Money; days: bigint }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = sorted[i - 1]!.date.daysUntil(sorted[i]!.date);
    if (days <= 0) continue;
    periods.push({ delta: sorted[i]!.balance.sub(sorted[i - 1]!.balance), days: BigInt(days) });
  }
  if (periods.length === 0) return undefined;

  const anchor = sorted[sorted.length - 1]!;
  const count = BigInt(periods.length);
  // sum_i(delta_i * elapsed / (days_i * n)), each term rounded once — avoids carrying a
  // pre-rounded daily rate that would compound error over long horizons.
  const projectDays = (numerator: bigint, denominator: bigint) =>
    sumMoney(
      currency,
      periods.map((p) => p.delta.mulFraction(numerator, p.days * count * denominator)),
    );

  return {
    anchor,
    averageMonthlySavings: projectDays(1461n, 48n),
    valueAt(date: IsoDate): Money {
      return anchor.balance.add(projectDays(BigInt(anchor.date.daysUntil(date)), 1n));
    },
  };
}
