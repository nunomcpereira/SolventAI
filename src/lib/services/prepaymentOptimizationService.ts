import { type Loan } from "../../domain/loans/loan.js";
import { rankPrepaymentCandidates, type PrepaymentCandidate } from "../../engine/optimization/optimizePrepayments.js";
import { Money } from "../../engine/money/money.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { Decimal } from "../../engine/money/decimal.js";
import { type PrepaymentStrategy } from "../../engine/prepayment/prepayment.js";
import { type CurrencyCode } from "../../engine/money/currency.js";

export interface RankedPrepaymentAdvice {
  rank: number;
  isBest: boolean;
  loanId: string;
  loanName: string;
  category: string;
  rateDescription: string;
  outstandingPrincipal: Money;
  prepaymentAmountApplied: Money;
  penaltyFee: Money;
  totalCashOutflow: Money;
  interestSaved: Money;
  netSavings: Money;
  originalMonthlyPayment: Money | undefined;
  newMonthlyPayment: Money | undefined;
  monthlyPaymentSavings: Money | undefined;
  periodsSaved: number;
  newRemainingPeriods: number;
  feasible: boolean;
}

export interface PrepaymentOptimizationOptions {
  loans: Loan[];
  lumpSum: Money;
  strategy: PrepaymentStrategy;
  asOfDate?: IsoDate;
}

export function formatLoanRateDescription(loan: Loan): string {
  if (loan.rate.type === "fixed") {
    return `${(Number(loan.rate.annualRate.toString()) * 100).toFixed(2)}%`;
  }
  if (loan.rate.type === "variable") {
    const total = Number(loan.rate.currentIndexRate.toString()) + Number(loan.rate.spread.toString());
    return `${(total * 100).toFixed(2)}% (${loan.rate.index} + ${(Number(loan.rate.spread.toString()) * 100).toFixed(2)}%)`;
  }
  const fixedPart = (Number(loan.rate.fixedAnnualRate.toString()) * 100).toFixed(2);
  const spreadPart = (Number(loan.rate.spread.toString()) * 100).toFixed(2);
  return `${fixedPart}% fixed (${loan.rate.fixedPeriodCount}p), then ${loan.rate.index} + ${spreadPart}%`;
}

function resolvePeriodsElapsedBefore(loan: Loan, date: IsoDate): number {
  let months = (date.year * 12 + date.month) - (loan.startDate.year * 12 + loan.startDate.month);
  if (date.day < loan.startDate.day) months -= 1;
  return Math.min(Math.max(months, 0), loan.numberOfPeriods - 1);
}

function buildScheduleInputForOptimization(loan: Loan) {
  return {
    principal: loan.principal,
    startDate: loan.startDate,
    numberOfPeriods: loan.numberOfPeriods,
    paymentFrequency: loan.paymentFrequency,
    dayCountConvention: loan.dayCountConvention,
    amortizationType: loan.amortizationType,
    annualRateForPeriod: (periodIndex: number): Decimal => {
      if (loan.rate.type === "fixed") {
        return loan.rate.annualRate;
      }
      if (loan.rate.type === "variable") {
        return loan.rate.currentIndexRate.add(loan.rate.spread);
      }
      if (periodIndex <= loan.rate.fixedPeriodCount) {
        return loan.rate.fixedAnnualRate;
      }
      return loan.rate.currentIndexRate.add(loan.rate.spread);
    },
  };
}

/**
 * Optimizes and ranks prepayment candidates across the provided loan portfolio
 * for a given lump-sum budget and strategy ("reduce_payment" or "shorten_term").
 *
 * Uses the deterministic rankPrepaymentCandidates engine function to order
 * loans by net interest savings, feasibility, and efficiency.
 */
export function optimizePrepaymentsAcrossLoans({
  loans,
  lumpSum,
  strategy,
  asOfDate,
}: PrepaymentOptimizationOptions): RankedPrepaymentAdvice[] {
  if (!lumpSum.isPositive()) {
    return [];
  }

  const today = asOfDate ?? IsoDate.fromString(new Date().toISOString().slice(0, 10));
  const currency = lumpSum.currency;

  const eligibleCandidates: { candidate: PrepaymentCandidate; loan: Loan; periodsElapsed: number }[] = [];

  for (const loan of loans) {
    if (loan.principal.currency !== currency) {
      continue;
    }
    // "shorten_term" cannot be applied to interest-only loans
    if (loan.amortizationType === "interest_only" && strategy === "shorten_term") {
      continue;
    }

    const periodsElapsed = resolvePeriodsElapsedBefore(loan, today);
    if (periodsElapsed >= loan.numberOfPeriods) {
      continue; // Loan already fully matured
    }

    const originalScheduleInput = buildScheduleInputForOptimization(loan);
    const candidateInput = {
      originalSchedule: originalScheduleInput,
      periodsElapsed,
      prepaymentAmount: lumpSum,
      strategy,
      penaltyRule: loan.prepaymentPenalty,
    };

    eligibleCandidates.push({
      candidate: { loanId: loan.id, input: candidateInput },
      loan,
      periodsElapsed,
    });
  }

  if (eligibleCandidates.length === 0) {
    return [];
  }

  const candidateMap = new Map(eligibleCandidates.map((c) => [c.loan.id, c]));
  const ranked = rankPrepaymentCandidates(
    eligibleCandidates.map((c) => c.candidate),
    {
      currency: currency as CurrencyCode,
      availableLiquidity: lumpSum,
    },
  );

  return ranked.map((item, index) => {
    const meta = candidateMap.get(item.loanId)!;
    const loan = meta.loan;
    const periodsElapsed = meta.periodsElapsed;
    const result = item.result;

    const openingPrincipal =
      result.originalSchedule[periodsElapsed]?.openingPrincipal ?? loan.principal;
    const prepaymentAmountApplied = openingPrincipal.sub(result.principalAfterPrepayment);
    const penaltyFee = result.penalty;
    const netSavings = result.interestSaved.sub(penaltyFee);

    const originalPayment = result.originalSchedule[periodsElapsed]?.scheduledPayment;
    const newPayment = result.principalAfterPrepayment.isZero()
      ? Money.zero(currency)
      : result.newSchedule[periodsElapsed]?.scheduledPayment;
    const monthlyPaymentSavings =
      originalPayment && newPayment ? originalPayment.sub(newPayment) : undefined;

    const remainingPeriodsBefore = loan.numberOfPeriods - periodsElapsed;
    const remainingPeriodsAfter = result.principalAfterPrepayment.isZero()
      ? 0
      : result.newSchedule.length - periodsElapsed;
    const periodsSaved = Math.max(remainingPeriodsBefore - remainingPeriodsAfter, 0);

    return {
      rank: index + 1,
      isBest: index === 0,
      loanId: loan.id,
      loanName: loan.name,
      category: loan.category,
      rateDescription: formatLoanRateDescription(loan),
      outstandingPrincipal: openingPrincipal,
      prepaymentAmountApplied,
      penaltyFee,
      totalCashOutflow: result.totalCashOutflow,
      interestSaved: result.interestSaved,
      netSavings,
      originalMonthlyPayment: originalPayment,
      newMonthlyPayment: newPayment,
      monthlyPaymentSavings,
      periodsSaved,
      newRemainingPeriods: remainingPeriodsAfter,
      feasible: item.feasible,
    };
  });
}
