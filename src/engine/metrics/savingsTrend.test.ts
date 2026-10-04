import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { computeSavingsTrend } from "./savingsTrend.js";

const m = (s: string) => Money.fromDecimalString(s, "EUR");
const d = (s: string) => IsoDate.fromString(s);

describe("computeSavingsTrend", () => {
  it("needs at least two checkpoints on distinct dates", () => {
    expect(computeSavingsTrend("EUR", [])).toBeUndefined();
    expect(computeSavingsTrend("EUR", [{ date: d("2026-01-01"), balance: m("100.00") }])).toBeUndefined();
    expect(
      computeSavingsTrend("EUR", [
        { date: d("2026-01-01"), balance: m("100.00") },
        { date: d("2026-01-01"), balance: m("200.00") },
      ]),
    ).toBeUndefined();
  });

  it("averages per-period rates and extrapolates from the latest checkpoint", () => {
    // Period 1: +100 over 10 days (10/day). Period 2: +600 over 20 days (30/day). Mean = 20/day.
    const trend = computeSavingsTrend("EUR", [
      { date: d("2026-01-31"), balance: m("1700.00") },
      { date: d("2026-01-01"), balance: m("1000.00") },
      { date: d("2026-01-11"), balance: m("1100.00") },
    ])!;
    expect(trend.anchor.date.toString()).toBe("2026-01-31");
    expect(trend.valueAt(d("2026-02-10")).toDecimalString()).toBe("1900.00");
    expect(trend.valueAt(d("2026-01-21")).toDecimalString()).toBe("1500.00");
    expect(trend.averageMonthlySavings.toDecimalString()).toBe("608.75");
  });

  it("projects a declining line when balances drop", () => {
    const trend = computeSavingsTrend("EUR", [
      { date: d("2026-01-01"), balance: m("1000.00") },
      { date: d("2026-01-11"), balance: m("900.00") },
    ])!;
    expect(trend.valueAt(d("2026-01-21")).toDecimalString()).toBe("800.00");
  });
});
