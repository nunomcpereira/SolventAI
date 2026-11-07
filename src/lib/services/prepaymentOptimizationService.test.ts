import { describe, expect, it } from "vitest";
import { parseLoan, type Loan } from "../../domain/loans/loan.js";
import { Money } from "../../engine/money/money.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { optimizePrepaymentsAcrossLoans } from "./prepaymentOptimizationService.js";

function makeLoan(overrides: Record<string, unknown> = {}): Loan {
  return parseLoan({
    id: "loan-1",
    name: "Mortgage",
    category: "mortgage",
    principal: { minorUnits: "15000000", currency: "EUR" },
    startDate: "2024-01-01",
    numberOfPeriods: 360,
    paymentFrequency: "monthly",
    dayCountConvention: "30/360",
    amortizationType: "french",
    rate: {
      type: "fixed",
      annualRate: "0.03",
    },
    fees: [],
    prepaymentPenalty: {
      type: "percentage",
      rate: "0.005",
    },
    sourceAccountId: "acc-1",
    ...overrides,
  });
}

describe("optimizePrepaymentsAcrossLoans", () => {
  it("ranks a higher interest rate loan first when both are feasible", () => {
    const loanLow = makeLoan({
      id: "loan-low",
      name: "Low Rate Mortgage",
      rate: { type: "fixed", annualRate: "0.02" },
    });
    const loanHigh = makeLoan({
      id: "loan-high",
      name: "High Rate Consumer",
      rate: { type: "fixed", annualRate: "0.07" },
    });

    const results = optimizePrepaymentsAcrossLoans({
      loans: [loanLow, loanHigh],
      lumpSum: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "reduce_payment",
      asOfDate: IsoDate.fromString("2025-01-01"),
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.loanId).toBe("loan-high");
    expect(results[0]?.rank).toBe(1);
    expect(results[0]?.isBest).toBe(true);
    expect(results[1]?.loanId).toBe("loan-low");
    expect(results[1]?.rank).toBe(2);
    expect(results[1]?.isBest).toBe(false);

    // High rate loan should save more interest
    expect(results[0]!.interestSaved.compare(results[1]!.interestSaved)).toBeGreaterThan(0);
    expect(results[0]?.monthlyPaymentSavings?.isPositive()).toBe(true);
  });

  it("calculates periodsSaved when strategy is shorten_term", () => {
    const loan = makeLoan({
      id: "loan-shorten",
      name: "Mortgage",
      numberOfPeriods: 120,
      rate: { type: "fixed", annualRate: "0.04" },
    });

    const results = optimizePrepaymentsAcrossLoans({
      loans: [loan],
      lumpSum: Money.fromDecimalString("20000.00", "EUR"),
      strategy: "shorten_term",
      asOfDate: IsoDate.fromString("2024-06-01"),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.periodsSaved).toBeGreaterThan(0);
    expect(results[0]?.newRemainingPeriods).toBeLessThan(120);
  });

  it("gracefully ignores interest-only loans when strategy is shorten_term", () => {
    const loanInterestOnly = makeLoan({
      id: "loan-io",
      amortizationType: "interest_only",
    });

    const results = optimizePrepaymentsAcrossLoans({
      loans: [loanInterestOnly],
      lumpSum: Money.fromDecimalString("5000.00", "EUR"),
      strategy: "shorten_term",
      asOfDate: IsoDate.fromString("2024-06-01"),
    });

    expect(results).toHaveLength(0);
  });

  it("filters out loans denominated in a different currency", () => {
    const loanUsd = makeLoan({
      id: "loan-usd",
      principal: { minorUnits: "5000000", currency: "USD" },
    });

    const results = optimizePrepaymentsAcrossLoans({
      loans: [loanUsd],
      lumpSum: Money.fromDecimalString("5000.00", "EUR"),
      strategy: "reduce_payment",
    });

    expect(results).toHaveLength(0);
  });

  it("caps prepayment amount when lump sum exceeds outstanding balance", () => {
    const loanSmall = makeLoan({
      id: "loan-small",
      principal: { minorUnits: "300000", currency: "EUR" }, // 3,000 EUR
      numberOfPeriods: 24,
      startDate: "2024-01-01",
    });

    const results = optimizePrepaymentsAcrossLoans({
      loans: [loanSmall],
      lumpSum: Money.fromDecimalString("10000.00", "EUR"), // 10,000 EUR > 3,000 EUR
      strategy: "reduce_payment",
      asOfDate: IsoDate.fromString("2024-01-01"),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.prepaymentAmountApplied.toDecimalString()).toBe("3000.00");
    expect(results[0]?.newRemainingPeriods).toBe(0);
  });
});
