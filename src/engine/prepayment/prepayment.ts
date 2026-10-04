import { IsoDate } from "../dates/isoDate.js";
import { type Frequency, stepDate } from "../dates/frequency.js";
import { type DayCountConvention, yearFraction } from "../dayCount/dayCount.js";
import { Money, sumMoney } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { type CurrencyCode } from "../money/currency.js";
import {
  generateAmortizationSchedule,
  type AmortizationEntry,
  type AmortizationInput,
  type AmortizationType,
} from "../amortization/amortization.js";
import { computePrepaymentPenalty, type PrepaymentPenaltyRule } from "./penalty.js";

export type { PrepaymentPenaltyRule } from "./penalty.js";
export { computePrepaymentPenalty } from "./penalty.js";

export type PrepaymentStrategy = "reduce_payment" | "shorten_term";

export interface PrepaymentInput {
  /** The loan's ORIGINAL (unmodified) amortization parameters, from origination. */
  originalSchedule: Omit<AmortizationInput, "principal"> & { principal: Money };
  /**
   * How many of `originalSchedule`'s periods have already elapsed before the
   * prepayment is applied (0 means the prepayment happens before period 1).
   */
  periodsElapsed: number;
  prepaymentAmount: Money;
  strategy: PrepaymentStrategy;
  penaltyRule: PrepaymentPenaltyRule;
}

export interface PrepaymentResult {
  penalty: Money;
  /** Total cash leaving the source account: prepaymentAmount + penalty. */
  totalCashOutflow: Money;
  /** Principal immediately after the prepayment is applied. */
  principalAfterPrepayment: Money;
  /** Full original schedule, unaffected — kept for comparison/audit. */
  originalSchedule: AmortizationEntry[];
  /**
   * Combined new schedule: the elapsed original periods, followed by the
   * recomputed post-prepayment periods (fewer periods for "shorten_term").
   */
  newSchedule: AmortizationEntry[];
  /** Total interest under the original schedule minus total interest under the new one. */
  interestSaved: Money;
}

/**
 * Applies a lump-sum prepayment at a given point in a loan's life and recomputes the
 * remaining schedule under one of two strategies:
 *  - "reduce_payment": keeps the original number of remaining periods, letting the
 *    per-period payment drop (this is what generateAmortizationSchedule already does
 *    when given a smaller principal, since it recomputes payment from remaining
 *    principal/periods every period).
 *  - "shorten_term": keeps the payment amount the loan was making just before the
 *    prepayment, and lets the loan pay off early (fewer periods) instead. Only
 *    defined for "french" and "constant_amortization" — an interest-only loan has no
 *    amortizing payment to hold constant, so this throws for that type.
 * The prepayment can never exceed the outstanding principal, and never creates money:
 * principalAfterPrepayment = openingPrincipal - prepaymentAmount (never below zero).
 */
export function applyPrepayment(input: PrepaymentInput): PrepaymentResult {
  const { originalSchedule, periodsElapsed, prepaymentAmount, strategy, penaltyRule } = input;
  if (periodsElapsed < 0 || !Number.isInteger(periodsElapsed) || periodsElapsed >= originalSchedule.numberOfPeriods) {
    throw new Error("applyPrepayment: periodsElapsed must be in [0, numberOfPeriods)");
  }
  if (!prepaymentAmount.isPositive()) {
    throw new Error("applyPrepayment: prepaymentAmount must be positive");
  }

  const fullOriginal = generateAmortizationSchedule(originalSchedule as AmortizationInput);
  const elapsed = fullOriginal.slice(0, periodsElapsed);
  const openingPrincipalAtPrepayment = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.closingPrincipal : originalSchedule.principal;

  const cappedPrepayment = prepaymentAmount.min(openingPrincipalAtPrepayment);
  const principalAfterPrepayment = openingPrincipalAtPrepayment.sub(cappedPrepayment);
  const penalty = computePrepaymentPenalty(penaltyRule, cappedPrepayment);

  const remainingOriginalPeriods = originalSchedule.numberOfPeriods - periodsElapsed;
  const nextDate = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.date : originalSchedule.startDate;
  const annualRateForRemainingPeriod = (localIndex: number, accrualStart: IsoDate, accrualEnd: IsoDate) =>
    originalSchedule.annualRateForPeriod(periodsElapsed + localIndex, accrualStart, accrualEnd);
  const feeForRemainingPeriod = originalSchedule.feeForPeriod
    ? (localIndex: number) => originalSchedule.feeForPeriod!(periodsElapsed + localIndex)
    : undefined;

  let postPrepaymentSchedule: AmortizationEntry[];

  if (principalAfterPrepayment.isZero()) {
    postPrepaymentSchedule = [];
  } else if (strategy === "reduce_payment") {
    // generateAmortizationSchedule always numbers its own output 1..numberOfPeriods —
    // shift those back onto the loan's real period numbering (continuing on from
    // `elapsed`'s last period) so `newSchedule` below has one entry per period with no
    // collisions, matching what generateFixedPaymentSchedule already does for
    // "shorten_term".
    postPrepaymentSchedule = generateAmortizationSchedule({
      principal: principalAfterPrepayment,
      startDate: nextDate,
      numberOfPeriods: remainingOriginalPeriods,
      paymentFrequency: originalSchedule.paymentFrequency,
      dayCountConvention: originalSchedule.dayCountConvention,
      amortizationType: originalSchedule.amortizationType,
      annualRateForPeriod: annualRateForRemainingPeriod,
      ...(feeForRemainingPeriod ? { feeForPeriod: feeForRemainingPeriod } : {}),
    }).map((entry) => ({ ...entry, period: entry.period + periodsElapsed }));
  } else {
    const targetPayment = elapsed.length > 0 ? elapsed[elapsed.length - 1]!.scheduledPayment : undefined;
    postPrepaymentSchedule = generateFixedPaymentSchedule({
      principal: principalAfterPrepayment,
      startDate: nextDate,
      maxPeriods: remainingOriginalPeriods,
      paymentFrequency: originalSchedule.paymentFrequency,
      dayCountConvention: originalSchedule.dayCountConvention,
      amortizationType: originalSchedule.amortizationType,
      annualRateForPeriod: annualRateForRemainingPeriod,
      ...(feeForRemainingPeriod ? { feeForPeriod: feeForRemainingPeriod } : {}),
      fixedPayment: targetPayment,
      periodsElapsed,
    });
  }

  const newSchedule = [...elapsed, ...postPrepaymentSchedule];
  const currency: CurrencyCode = originalSchedule.principal.currency;
  const originalInterestTotal = sumMoney(currency, fullOriginal.map((e) => e.interest));
  const newInterestTotal = sumMoney(currency, newSchedule.map((e) => e.interest));
  const interestSaved = originalInterestTotal.sub(newInterestTotal);

  return {
    penalty,
    totalCashOutflow: cappedPrepayment.add(penalty),
    principalAfterPrepayment,
    originalSchedule: fullOriginal,
    newSchedule,
    interestSaved,
  };
}

interface FixedPaymentInput {
  principal: Money;
  startDate: IsoDate;
  maxPeriods: number;
  paymentFrequency: Frequency;
  dayCountConvention: DayCountConvention;
  amortizationType: AmortizationType;
  annualRateForPeriod: (periodIndex: number, accrualStart: IsoDate, accrualEnd: IsoDate) => Decimal;
  feeForPeriod?: (periodIndex: number) => Money;
  /** The payment amount to hold constant. If undefined (prepayment at period 0), falls back to the annuity payment for maxPeriods. */
  fixedPayment: Money | undefined;
  periodsElapsed: number;
}

/**
 * Generates a schedule that pays a constant `fixedPayment` each period (interest +
 * principal), ending as soon as the balance reaches zero — which may be sooner than
 * `maxPeriods`. This implements the "shorten_term" prepayment strategy. Undefined for
 * "interest_only" (no amortizing payment to hold constant).
 */
function generateFixedPaymentSchedule(input: FixedPaymentInput): AmortizationEntry[] {
  if (input.amortizationType === "interest_only") {
    throw new Error('generateFixedPaymentSchedule: "shorten_term" is undefined for interest-only loans');
  }
  const currency = input.principal.currency;

  const fixedPayment =
    input.fixedPayment ??
    generateAmortizationSchedule({
      principal: input.principal,
      startDate: input.startDate,
      numberOfPeriods: input.maxPeriods,
      paymentFrequency: input.paymentFrequency,
      dayCountConvention: input.dayCountConvention,
      amortizationType: "french",
      annualRateForPeriod: input.annualRateForPeriod,
    })[0]?.scheduledPayment ?? Money.zero(currency);

  const entries: AmortizationEntry[] = [];
  let openingPrincipal = input.principal;
  let accrualStart = input.startDate;

  for (let localIndex = 1; localIndex <= input.maxPeriods && openingPrincipal.isPositive(); localIndex++) {
    const accrualEnd = stepDate(accrualStart, input.paymentFrequency);
    const annualRate = input.annualRateForPeriod(localIndex, accrualStart, accrualEnd);
    const fraction = yearFraction(accrualStart, accrualEnd, input.dayCountConvention);
    const interest = openingPrincipal.mulDecimal(annualRate.mul(fraction));
    const fees = input.feeForPeriod ? input.feeForPeriod(localIndex) : Money.zero(currency);
    const isLastPossiblePeriod = localIndex === input.maxPeriods;

    let principalPayment = fixedPayment.sub(interest);
    if (principalPayment.isNegative()) principalPayment = Money.zero(currency);
    if (principalPayment.compare(openingPrincipal) > 0 || isLastPossiblePeriod) {
      principalPayment = openingPrincipal;
    }

    const closingPrincipal = openingPrincipal.sub(principalPayment);
    const scheduledPayment = principalPayment.add(interest);

    entries.push({
      period: input.periodsElapsed + localIndex,
      date: accrualEnd,
      openingPrincipal,
      scheduledPayment,
      interest,
      principal: principalPayment,
      fees,
      totalCashOutflow: scheduledPayment.add(fees),
      closingPrincipal,
      rate: annualRate,
    });

    openingPrincipal = closingPrincipal;
    accrualStart = accrualEnd;
  }

  return entries;
}
