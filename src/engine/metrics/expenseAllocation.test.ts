import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { computeExpenseAllocation, monthlyEquivalent } from "./expenseAllocation.js";

const eur = (v: string) => Money.fromDecimalString(v, "EUR");
const d = (s: string) => IsoDate.fromString(s);
const today = d("2026-11-15");

describe("monthlyEquivalent", () => {
  it("spreads other frequencies over the month", () => {
    expect(monthlyEquivalent(eur("120"), "annual").toDecimalString()).toBe("10.00");
    expect(monthlyEquivalent(eur("90"), "quarterly").toDecimalString()).toBe("30.00");
    expect(monthlyEquivalent(eur("10"), "weekly").toDecimalString()).toBe("43.33");
    expect(monthlyEquivalent(eur("46.90"), "monthly").toDecimalString()).toBe("46.90");
  });
});

describe("computeExpenseAllocation", () => {
  it("groups by category, largest first, with shares that add up to 1", () => {
    const a = computeExpenseAllocation(
      [
        { category: "utilities", amount: eur("50"), frequency: "monthly", startDate: d("2026-01-01") },
        { category: "food", amount: eur("300"), frequency: "monthly", startDate: d("2026-01-01") },
        { category: "utilities", amount: eur("600"), frequency: "annual", startDate: d("2026-01-01") },
      ],
      "EUR",
      today,
    );
    expect(a.totalMonthly.toDecimalString()).toBe("400.00");
    expect(a.categories.map((c) => [c.category, c.monthly.toDecimalString(), c.share, c.itemCount])).toEqual([
      ["food", "300.00", 0.75, 1],
      ["utilities", "100.00", 0.25, 2],
    ]);
    expect(a.itemCount).toBe(3);
  });

  it("leaves out items that ended, haven't started, or are one-offs", () => {
    const a = computeExpenseAllocation(
      [
        { category: "food", amount: eur("100"), frequency: "monthly", startDate: d("2025-01-01"), endDate: d("2026-10-31") },
        { category: "food", amount: eur("100"), frequency: "monthly", startDate: d("2027-01-01") },
        { category: "food", amount: eur("80"), frequency: "monthly", startDate: d("2026-11-15"), endDate: d("2026-11-15") },
        { category: "food", amount: eur("60"), frequency: "monthly", startDate: d("2026-11-01"), endDate: d("2027-03-31") },
      ],
      "EUR",
      today,
    );
    expect(a.totalMonthly.toDecimalString()).toBe("60.00");
    expect(a.itemCount).toBe(1);
  });

  it("is empty without items", () => {
    const a = computeExpenseAllocation([], "EUR", today);
    expect(a.totalMonthly.isZero()).toBe(true);
    expect(a.categories).toEqual([]);
  });
});
