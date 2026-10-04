import { Money } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";
import { applyPrepayment, type PrepaymentInput, type PrepaymentResult } from "../prepayment/prepayment.js";

export interface PrepaymentCandidate {
  loanId: string;
  input: PrepaymentInput;
}

/**
 * Explicit objective and constraints (spec section 19) — nothing here is called
 * "optimal" without both being stated:
 *   maximize interest saved
 *   subject to: cash outflow (prepayment amount + penalty) <= availableLiquidity
 * `availableLiquidity` is the caller-supplied headroom above minimum reserve (e.g.
 * from engine/metrics.availableLiquidity) that may be spent on prepayments; it is a
 * single shared budget across all candidates in this ranking, not verified per-account
 * — a caller combining candidates that draw from different accounts must check each
 * account's own headroom separately before acting on the ranking.
 */
export interface OptimizationConstraints {
  currency: CurrencyCode;
  availableLiquidity: Money;
}

export interface RankedPrepayment {
  loanId: string;
  result: PrepaymentResult;
  /** True iff this candidate's cash outflow alone fits within availableLiquidity. */
  feasible: boolean;
}

/**
 * Ranks prepayment candidates by the stated objective: maximize interest saved,
 * subject to affordability. Ordering (fully deterministic):
 *   1. feasible candidates before infeasible ones;
 *   2. within each group, higher interestSaved first;
 *   3. ties broken by lower totalCashOutflow (more efficient use of cash);
 *   4. remaining ties broken by loanId (lexicographic), so the order is total.
 * This ranks candidates independently — it does NOT select a combination that
 * maximizes total interest saved under a shared budget (a knapsack problem); a caller
 * wanting that should greedily walk this ranking, subtracting each accepted
 * candidate's cash outflow from the remaining budget.
 */
export function rankPrepaymentCandidates(
  candidates: readonly PrepaymentCandidate[],
  constraints: OptimizationConstraints,
): RankedPrepayment[] {
  const ranked: RankedPrepayment[] = candidates.map((candidate) => {
    const result = applyPrepayment(candidate.input);
    if (result.totalCashOutflow.currency !== constraints.currency) {
      throw new Error(
        `rankPrepaymentCandidates: candidate ${candidate.loanId} currency ${result.totalCashOutflow.currency} does not match constraints currency ${constraints.currency}`,
      );
    }
    const feasible = result.totalCashOutflow.compare(constraints.availableLiquidity) <= 0;
    return { loanId: candidate.loanId, result, feasible };
  });

  return ranked.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    const interestCompare = b.result.interestSaved.compare(a.result.interestSaved);
    if (interestCompare !== 0) return interestCompare;
    const cashCompare = a.result.totalCashOutflow.compare(b.result.totalCashOutflow);
    if (cashCompare !== 0) return cashCompare;
    return a.loanId < b.loanId ? -1 : a.loanId > b.loanId ? 1 : 0;
  });
}
