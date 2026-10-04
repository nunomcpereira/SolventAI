import { IsoDate } from "../dates/isoDate.js";
import { type Frequency, PERIODS_PER_YEAR, stepDate } from "../dates/frequency.js";
import { type DayCountConvention, yearFraction } from "../dayCount/dayCount.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { type CurrencyCode } from "../money/currency.js";

export type AmortizationType = "french" | "constant_amortization" | "interest_only";

export interface AmortizationEntry {
  period: number;
  date: IsoDate;
  openingPrincipal: Money;
  scheduledPayment: Money;
  interest: Money;
  principal: Money;
  fees: Money;
  totalCashOutflow: Money;
  closingPrincipal: Money;
  rate: Decimal;
}

export interface AmortizationInput {
  principal: Money;
  startDate: IsoDate;
  numberOfPeriods: number;
  paymentFrequency: Frequency;
  dayCountConvention: DayCountConvention;
  amortizationType: AmortizationType;
  /**
   * Resolves the effective annual rate applicable to period `periodIndex` (1-based),
   * accruing over [accrualStartDate, accrualEndDate). Callers typically implement this
   * via engine/rates' `resolveEffectiveRate`, keeping any benchmark lookup out of here.
   */
  annualRateForPeriod: (periodIndex: number, accrualStartDate: IsoDate, accrualEndDate: IsoDate) => Decimal;
  /** Fee charged in a given period (1-based), if any. Defaults to zero. */
  feeForPeriod?: (periodIndex: number) => Money;
}

/**
 * Generates a full amortization schedule. Every period reconciles exactly:
 *   openingPrincipal - principal === closingPrincipal
 * and the final period always drives closingPrincipal to exactly zero (residual
 * rounding is absorbed into the last period's principal/payment, per the centralized
 * rounding policy — see engine/money/rounding.ts).
 *
 * For "french" (constant payment), the payment is a fresh annuity calculation each
 * period over the then-remaining principal, remaining periods, and current period
 * rate. This is a deliberate, documented choice: it is the only approach that stays
 * exact when the rate is variable (mid-schedule resets), since a single payment fixed
 * at origination cannot be guaranteed to reconcile against a rate path decided later.
 * For a fixed-rate loan this reduces to the standard constant monthly payment, because
 * the recomputed annuity is unchanged when the rate and remaining term are unchanged.
 */
export function generateAmortizationSchedule(input: AmortizationInput): AmortizationEntry[] {
  const { principal, startDate, numberOfPeriods, paymentFrequency, dayCountConvention, amortizationType } = input;
  if (numberOfPeriods <= 0 || !Number.isInteger(numberOfPeriods)) {
    throw new Error("generateAmortizationSchedule: numberOfPeriods must be a positive integer");
  }
  const currency: CurrencyCode = principal.currency;
  const periodsPerYear = PERIODS_PER_YEAR[paymentFrequency];

  const entries: AmortizationEntry[] = [];
  let openingPrincipal = principal;
  let accrualStart = startDate;

  for (let period = 1; period <= numberOfPeriods; period++) {
    const accrualEnd = stepDate(accrualStart, paymentFrequency);
    const annualRate = input.annualRateForPeriod(period, accrualStart, accrualEnd);
    const fraction = yearFraction(accrualStart, accrualEnd, dayCountConvention);
    const interest = openingPrincipal.mulDecimal(annualRate.mul(fraction));
    const fees = input.feeForPeriod ? input.feeForPeriod(period) : Money.zero(currency);
    const remainingPeriods = numberOfPeriods - period + 1;
    const isLastPeriod = period === numberOfPeriods;

    let principalPayment: Money;
    if (isLastPeriod) {
      principalPayment = openingPrincipal;
    } else if (amortizationType === "interest_only") {
      principalPayment = Money.zero(currency);
    } else if (amortizationType === "constant_amortization") {
      principalPayment = openingPrincipal.mulFraction(1n, BigInt(remainingPeriods));
    } else {
      const periodRate = annualRate.div(Decimal.fromBigInt(BigInt(periodsPerYear)));
      const payment = annuityPayment(openingPrincipal, periodRate, remainingPeriods);
      principalPayment = payment.sub(interest);
      if (principalPayment.isNegative()) principalPayment = Money.zero(currency);
      if (principalPayment.compare(openingPrincipal) > 0) principalPayment = openingPrincipal;
    }

    const closingPrincipal = openingPrincipal.sub(principalPayment);
    const scheduledPayment = principalPayment.add(interest);
    const totalCashOutflow = scheduledPayment.add(fees);

    entries.push({
      period,
      date: accrualEnd,
      openingPrincipal,
      scheduledPayment,
      interest,
      principal: principalPayment,
      fees,
      totalCashOutflow,
      closingPrincipal,
      rate: annualRate,
    });

    openingPrincipal = closingPrincipal;
    accrualStart = accrualEnd;
  }

  return entries;
}

/** Standard annuity payment: P * r / (1 - (1+r)^-n), degenerating to P/n when r === 0. */
function annuityPayment(principal: Money, periodRate: Decimal, remainingPeriods: number): Money {
  if (periodRate.isZero()) {
    return principal.mulFraction(1n, BigInt(remainingPeriods));
  }
  const onePlusR = Decimal.ONE.add(periodRate);
  const discountFactor = Decimal.ONE.sub(onePlusR.pow(remainingPeriods).reciprocal());
  const factor = periodRate.div(discountFactor);
  return principal.mulDecimal(factor);
}
