import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import {
  totalLiquidity,
  availableLiquidity,
  findAccountReserveBreaches,
  liquidityRunway,
  minimumLiquidity,
  findLiquidityBreaches,
  computeSolvencyRisk,
  type PeriodLiquiditySnapshot,
} from "./liquidity.js";

const m = (s: string) => Money.fromDecimalString(s, "EUR");
const d = (s: string) => IsoDate.fromString(s);

function snapshot(period: number, accounts: { accountId: string; balance: string; reserve: string }[]): PeriodLiquiditySnapshot {
  return {
    period,
    date: d("2026-01-01").addMonths(period),
    accounts: accounts.map((a) => ({ accountId: a.accountId, balance: m(a.balance), minimumReserve: m(a.reserve) })),
  };
}

describe("totalLiquidity / availableLiquidity", () => {
  it("sums balances and subtracts reserves", () => {
    const snap = snapshot(0, [
      { accountId: "checking", balance: "5000.00", reserve: "1000.00" },
      { accountId: "savings", balance: "20000.00", reserve: "5000.00" },
    ]);
    expect(totalLiquidity("EUR", snap).toDecimalString()).toBe("25000.00");
    expect(availableLiquidity("EUR", snap).toDecimalString()).toBe("19000.00");
  });

  it("available liquidity can go negative", () => {
    const snap = snapshot(0, [{ accountId: "checking", balance: "500.00", reserve: "1000.00" }]);
    expect(availableLiquidity("EUR", snap).toDecimalString()).toBe("-500.00");
  });
});

describe("findAccountReserveBreaches", () => {
  it("flags accounts below their own minimum reserve", () => {
    const snap = snapshot(0, [
      { accountId: "checking", balance: "500.00", reserve: "1000.00" },
      { accountId: "savings", balance: "20000.00", reserve: "5000.00" },
    ]);
    const breaches = findAccountReserveBreaches(snap);
    expect(breaches.map((b) => b.accountId)).toEqual(["checking"]);
  });
});

describe("liquidityRunway / minimumLiquidity", () => {
  it("returns the first period index where aggregate available liquidity goes negative", () => {
    const periods = [
      snapshot(0, [{ accountId: "a", balance: "5000.00", reserve: "1000.00" }]),
      snapshot(1, [{ accountId: "a", balance: "2000.00", reserve: "1000.00" }]),
      snapshot(2, [{ accountId: "a", balance: "500.00", reserve: "1000.00" }]),
    ];
    expect(liquidityRunway("EUR", periods)).toBe(2);
  });

  it("returns undefined when never breached", () => {
    const periods = [snapshot(0, [{ accountId: "a", balance: "5000.00", reserve: "1000.00" }])];
    expect(liquidityRunway("EUR", periods)).toBeUndefined();
  });

  it("minimumLiquidity is the lowest available liquidity across periods", () => {
    const periods = [
      snapshot(0, [{ accountId: "a", balance: "5000.00", reserve: "1000.00" }]),
      snapshot(1, [{ accountId: "a", balance: "1500.00", reserve: "1000.00" }]),
    ];
    expect(minimumLiquidity("EUR", periods).toDecimalString()).toBe("500.00");
  });

  it("minimumLiquidity throws on empty input", () => {
    expect(() => minimumLiquidity("EUR", [])).toThrow();
  });
});

describe("findLiquidityBreaches", () => {
  it("reports both global and account-level breaches", () => {
    const periods = [
      snapshot(0, [{ accountId: "a", balance: "500.00", reserve: "1000.00" }]),
      snapshot(1, [{ accountId: "a", balance: "5000.00", reserve: "1000.00" }]),
    ];
    const events = findLiquidityBreaches("EUR", periods);
    expect(events).toEqual([
      { period: 0, date: periods[0]!.date, scope: "global" },
      { period: 0, date: periods[0]!.date, scope: "account", accountId: "a" },
    ]);
  });
});

describe("computeSolvencyRisk", () => {
  it("returns 100% when balance is zero or negative", () => {
    expect(computeSolvencyRisk(0, 100000)).toBe(100);
    expect(computeSolvencyRisk(-500, 100000)).toBe(100);
    expect(computeSolvencyRisk(0, 0)).toBe(100);
  });

  it("returns 0% when debt is zero or balance exceeds debt", () => {
    expect(computeSolvencyRisk(10000, 0)).toBe(0);
    expect(computeSolvencyRisk(100000, 50000)).toBe(0);
    expect(computeSolvencyRisk(50000, 50000)).toBe(0);
  });

  it("scales linearly with the ratio of balance to debt", () => {
    expect(computeSolvencyRisk(50000, 100000)).toBe(50);
    expect(computeSolvencyRisk(75000, 100000)).toBe(25);
  });
});
