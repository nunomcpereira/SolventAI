import "server-only";
import { type Loan } from "../../domain/loans/loan.js";
import { generateAmortizationSchedule, type AmortizationEntry } from "../../engine/amortization/amortization.js";
import { applyPrepayment, type PrepaymentStrategy, type PrepaymentResult } from "../../engine/prepayment/prepayment.js";
import { Decimal } from "../../engine/money/decimal.js";
import { type Money } from "../../engine/money/money.js";
import { type IsoDate } from "../../engine/dates/isoDate.js";

export class MissingRateDataError extends Error {
  constructor(loanId: string) {
    super(`Loan "${loanId}" is missing required variable-rate fixing data.`);
    this.name = "MissingRateDataError";
  }
}

/** A hypothetical replacement for a variable-rate index's value (e.g. "what if Euribor
 * 6M becomes 5% from period N onward"), used to simulate a rate_change event without
 * touching the loan's own stored `currentIndexRate`. */
export interface IndexRateOverride {
  index: string;
  /** First loan-own period (1-based) this override applies to; earlier periods use the loan's stored rate. */
  fromPeriod: number;
  newAnnualValue: Decimal;
}

export function loanAnnualRateForPeriod(loan: Loan, override?: IndexRateOverride): (periodIndex: number) => Decimal {
  return (periodIndex: number): Decimal => {
    if (loan.rate.type === "fixed") {
      return loan.rate.annualRate;
    }
    const indexRate =
      override !== undefined && override.index === loan.rate.index && periodIndex >= override.fromPeriod
        ? override.newAnnualValue
        : loan.rate.currentIndexRate;
    if (loan.rate.type === "variable") {
      return indexRate.add(loan.rate.spread);
    }
    if (periodIndex <= loan.rate.fixedPeriodCount) {
      return loan.rate.fixedAnnualRate;
    }
    return indexRate.add(loan.rate.spread);
  };
}

export function buildLoanScheduleInput(loan: Loan, indexRateOverride?: IndexRateOverride) {
  return {
    principal: loan.principal,
    startDate: loan.startDate,
    numberOfPeriods: loan.numberOfPeriods,
    paymentFrequency: loan.paymentFrequency,
    dayCountConvention: loan.dayCountConvention,
    amortizationType: loan.amortizationType,
    annualRateForPeriod: loanAnnualRateForPeriod(loan, indexRateOverride),
  };
}

/**
 * Builds a loan's full amortization schedule (always over the loan's own
 * `numberOfPeriods` — the annuity payment for "french" amortization depends on the
 * REMAINING period count, so generating against a truncated horizon would force full
 * payoff within that window and wildly overstate the payment). Pass `maxPeriods` to
 * return only the first N entries of that correctly-computed schedule, e.g. for a
 * 12-month dashboard projection of a 360-month mortgage.
 *
 * Fixed, variable, and mixed contracts are supported. Variable and mixed loans use
 * the stored index value (e.g. Euribor) plus spread when fixing timelines are not
 * managed in-app.
 */
export function getLoanSchedule(loan: Loan, maxPeriods?: number, indexRateOverride?: IndexRateOverride): AmortizationEntry[] {
  const fullSchedule = generateAmortizationSchedule(buildLoanScheduleInput(loan, indexRateOverride));

  return maxPeriods === undefined ? fullSchedule : fullSchedule.slice(0, maxPeriods);
}

/** Number of whole periods of `loan`'s own monthly schedule that have fully elapsed
 * strictly before `date` (0 if `date` falls within loan's first period). Used to
 * apply a prepayment "as of" a given calendar date against the loan's own schedule. */
export function periodsElapsedBefore(loan: Loan, date: IsoDate): number {
  let months = (date.year * 12 + date.month) - (loan.startDate.year * 12 + loan.startDate.month);
  if (date.day < loan.startDate.day) months -= 1;
  return Math.min(Math.max(months, 0), loan.numberOfPeriods - 1);
}

/**
 * Applies a lump-sum prepayment to `loan`, recomputing its remaining schedule (see
 * engine/prepayment.applyPrepayment) using the loan's own penalty rule. Takes
 * `periodsElapsed` directly rather than a calendar date — callers driving this from a
 * simulation (whose period 1 is the simulation's own horizon start, not necessarily
 * the loan's origination date) should compute periodsElapsed relative to THEIR
 * period-1, matching however the rest of that simulation indexes this loan's
 * schedule. Use `periodsElapsedBefore` for the loan's own true calendar timeline.
 */
export function computeLoanPrepayment(
  loan: Loan,
  params: { periodsElapsed: number; prepaymentAmount: Money; strategy: PrepaymentStrategy; indexRateOverride?: IndexRateOverride },
): PrepaymentResult {
  return applyPrepayment({
    originalSchedule: buildLoanScheduleInput(loan, params.indexRateOverride),
    periodsElapsed: Math.min(Math.max(params.periodsElapsed, 0), loan.numberOfPeriods - 1),
    prepaymentAmount: params.prepaymentAmount,
    strategy: params.strategy,
    penaltyRule: loan.prepaymentPenalty,
  });
}
