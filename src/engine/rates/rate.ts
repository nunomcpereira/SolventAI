import { IsoDate } from "../dates/isoDate.js";
import { type Frequency, stepDate } from "../dates/frequency.js";
import { Decimal } from "../money/decimal.js";

/**
 * Generic interest-rate model. Not tied to any specific benchmark (Euribor, SOFR,
 * Prime, ...) — a variable rate references an `index` by name plus a `spread`, and
 * the index's historical/projected values are supplied externally via IndexFixing[].
 * This keeps benchmark-specific knowledge entirely out of the calculation engine.
 */
export type RateType = "fixed" | "variable" | "mixed";

export interface FixedRate {
  type: "fixed";
  annualRate: Decimal;
}

export interface VariableRate {
  type: "variable";
  /** Name of the external index, e.g. "EURIBOR_6M", "SOFR", "PRIME". Opaque to the engine. */
  index: string;
  spread: Decimal;
  resetFrequency: Frequency;
  /** Upper bound on the effective annual rate (index + spread), if any. */
  rateCap?: Decimal;
  /** Lower bound on the effective annual rate (index + spread), if any. */
  rateFloor?: Decimal;
  /**
   * Latest known annual value for the underlying index (e.g. current Euribor),
   * used when no fixing timeline is provided.
   */
  currentIndexRate: Decimal;
}

export interface MixedRate {
  type: "mixed";
  /** Fixed annual rate applied for the first `fixedPeriodCount` periods. */
  fixedAnnualRate: Decimal;
  /** Number of periods using the fixed leg before switching to variable. */
  fixedPeriodCount: number;
  /** Name of the external index, e.g. "EURIBOR_6M". */
  index: string;
  /** Latest known annual index value, e.g. current Euribor. */
  currentIndexRate: Decimal;
  /** Spread added on top of the index after the fixed leg. */
  spread: Decimal;
  resetFrequency: Frequency;
  rateCap?: Decimal;
  rateFloor?: Decimal;
}

export type Rate = FixedRate | VariableRate | MixedRate;

/** A single observed/projected value of an external index on a given date. */
export interface IndexFixing {
  index: string;
  effectiveDate: IsoDate;
  annualValue: Decimal;
}

/**
 * Resolves the effective annual rate on `asOfDate`. For a fixed rate this is constant.
 * For a variable rate, looks up the most recent fixing with effectiveDate <= asOfDate
 * from `fixings` (filtered to the matching index name), then applies spread and
 * cap/floor. Missing fixing data is a hard error — never silently assumed as zero.
 */
export function resolveEffectiveRate(rate: Rate, asOfDate: IsoDate, fixings: readonly IndexFixing[]): Decimal {
  if (rate.type === "fixed") {
    return rate.annualRate;
  }

  if (rate.type === "mixed") {
    return rate.fixedAnnualRate;
  }

  const matching = fixings
    .filter((f) => f.index === rate.index && f.effectiveDate.isSameOrBefore(asOfDate))
    .sort((a, b) => b.effectiveDate.compare(a.effectiveDate));

  const latest = matching[0];
  let effective = (latest?.annualValue ?? rate.currentIndexRate).add(rate.spread);
  if (rate.rateCap !== undefined) effective = effective.min(rate.rateCap);
  if (rate.rateFloor !== undefined) effective = effective.max(rate.rateFloor);
  return effective;
}

/**
 * Given `resetFrequency`, returns the reset dates on/after `fromDate` up to and
 * including `toDate` at which a variable rate's effective value may change.
 * Fixed rates never reset (returns an empty array).
 */
export function resetDatesInRange(rate: Rate, fromDate: IsoDate, toDate: IsoDate): IsoDate[] {
  if (rate.type === "fixed") return [];
  const dates: IsoDate[] = [];
  let current = fromDate;
  while (current.isSameOrBefore(toDate)) {
    dates.push(current);
    current = stepDate(current, rate.resetFrequency);
  }
  return dates;
}
