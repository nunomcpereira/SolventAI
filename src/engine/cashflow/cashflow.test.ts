import { describe, expect, it } from "vitest";
import { Money } from "../money/money.js";
import { computeCashFlowPeriod, runCashFlowSeries, totalLiquidity, type CashFlowComponents } from "./cashflow.js";

const m = (s: string) => Money.fromDecimalString(s, "EUR");
const zero = () => Money.zero("EUR");

function baseComponents(overrides: Partial<CashFlowComponents> = {}): CashFlowComponents {
  return {
    openingCash: zero(),
    income: zero(),
    transfersIn: zero(),
    livingExpenses: zero(),
    debtPayments: zero(),
    fees: zero(),
    prepayments: zero(),
    transfersOut: zero(),
    ...overrides,
  };
}

describe("computeCashFlowPeriod", () => {
  it("computes closing cash per the canonical formula", () => {
    const result = computeCashFlowPeriod(
      baseComponents({
        openingCash: m("1000.00"),
        income: m("3000.00"),
        transfersIn: m("200.00"),
        livingExpenses: m("800.00"),
        debtPayments: m("900.00"),
        fees: m("10.00"),
        prepayments: m("500.00"),
        transfersOut: m("150.00"),
      }),
    );
    // 1000 + 3000 + 200 - 800 - 900 - 10 - 500 - 150 = 1840
    expect(result.closingCash.toDecimalString()).toBe("1840.00");
  });

  it("allows negative opening cash (already overdrawn)", () => {
    const result = computeCashFlowPeriod(baseComponents({ openingCash: m("-100.00"), income: m("50.00") }));
    expect(result.closingCash.toDecimalString()).toBe("-50.00");
  });

  it("rejects negative magnitude fields", () => {
    expect(() => computeCashFlowPeriod(baseComponents({ income: m("-1.00") }))).toThrow(/non-negative/);
    expect(() => computeCashFlowPeriod(baseComponents({ debtPayments: m("-1.00") }))).toThrow(/non-negative/);
  });

  it("rejects currency mismatch across components", () => {
    expect(() =>
      computeCashFlowPeriod(baseComponents({ income: Money.fromDecimalString("10.00", "USD") })),
    ).toThrow(/currency/);
  });
});

describe("runCashFlowSeries", () => {
  it("chains closing cash into next period's opening cash", () => {
    const results = runCashFlowSeries(m("1000.00"), [
      { income: m("500.00"), transfersIn: zero(), livingExpenses: m("200.00"), debtPayments: zero(), fees: zero(), prepayments: zero(), transfersOut: zero() },
      { income: m("500.00"), transfersIn: zero(), livingExpenses: m("200.00"), debtPayments: zero(), fees: zero(), prepayments: zero(), transfersOut: zero() },
    ]);
    expect(results[0]!.closingCash.toDecimalString()).toBe("1300.00");
    expect(results[1]!.openingCash.toDecimalString()).toBe("1300.00");
    expect(results[1]!.closingCash.toDecimalString()).toBe("1600.00");
  });
});

describe("transfer conservation invariant", () => {
  it("an internal transfer between two accounts does not change total liquidity", () => {
    // Account A transfers 300 to Account B; both same currency, no other activity.
    const accountA = computeCashFlowPeriod(baseComponents({ openingCash: m("1000.00"), transfersOut: m("300.00") }));
    const accountB = computeCashFlowPeriod(baseComponents({ openingCash: m("500.00"), transfersIn: m("300.00") }));

    const totalBefore = m("1000.00").add(m("500.00"));
    const totalAfter = totalLiquidity("EUR", [accountA, accountB]);
    expect(totalAfter.equals(totalBefore)).toBe(true);
  });

  it("total liquidity changes by exactly external income/expenses, not by internal transfers", () => {
    const accountA = computeCashFlowPeriod(
      baseComponents({ openingCash: m("1000.00"), income: m("100.00"), transfersOut: m("300.00") }),
    );
    const accountB = computeCashFlowPeriod(
      baseComponents({ openingCash: m("500.00"), livingExpenses: m("50.00"), transfersIn: m("300.00") }),
    );
    const totalBefore = m("1000.00").add(m("500.00"));
    const totalAfter = totalLiquidity("EUR", [accountA, accountB]);
    // net external change: +100 income - 50 expense = +50
    expect(totalAfter.equals(totalBefore.add(m("50.00")))).toBe(true);
  });
});
