import { sumMoney } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { type CurrencyCode } from "../money/currency.js";
import { type AmortizationEntry } from "../amortization/amortization.js";

/**
 * Interest drag (spec section 18) — the documented definition, implemented once here:
 *
 *   Interest Drag = (sum of interest across the horizon) / (sum of scheduled
 *   payments — interest + principal — across the same horizon)
 *
 * i.e. the fraction of total debt-service cash flow that went to interest rather
 * than principal, over the given period range.
 *
 * - Numerator: `interest` only.
 * - Denominator: `principal + interest` (== `scheduledPayment`), i.e. the amortizing
 *   payment itself.
 * - Time horizon: exactly the `entries` passed in — callers slice the schedule to
 *   whatever window they want measured (e.g. first 12 months, life of loan).
 * - Fees: excluded entirely (a fee is neither interest nor principal amortization).
 * - Principal: included in the denominator, never the numerator.
 * - Prepayments: not modeled here directly — a prepayment's principal is a lump-sum
 *   event, not part of the "scheduled" payment; feed it in by including the relevant
 *   post-prepayment AmortizationEntry[] (see engine/prepayment) if it should count.
 *
 * Returns a Decimal fraction in [0, 1] (e.g. "0.62" = 62% of debt service was interest).
 * Throws if the entries sum to a zero scheduled payment (nothing to measure).
 */
export function computeInterestDrag(currency: CurrencyCode, entries: readonly AmortizationEntry[]): Decimal {
  const totalInterest = sumMoney(currency, entries.map((e) => e.interest));
  const totalScheduledPayment = sumMoney(currency, entries.map((e) => e.scheduledPayment));
  if (!totalScheduledPayment.isPositive()) {
    throw new Error("computeInterestDrag: total scheduled payment must be positive");
  }
  return Decimal.fromBigInt(totalInterest.minorUnits).div(Decimal.fromBigInt(totalScheduledPayment.minorUnits));
}
