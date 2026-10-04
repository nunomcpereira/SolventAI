import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { expandOccurrences } from "./recurringSchedule.js";

const d = (s: string) => IsoDate.fromString(s);
const m = (s: string) => Money.fromDecimalString(s, "EUR");

describe("expandOccurrences", () => {
  it("first occurrence is startDate itself, then steps by frequency", () => {
    const occurrences = expandOccurrences(
      { amount: m("100.00"), frequency: "monthly", startDate: d("2026-01-15") },
      d("2026-01-01"),
      d("2026-04-01"),
    );
    expect(occurrences.map((o) => o.date.toString())).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("clips to horizonStart and horizonEnd", () => {
    const occurrences = expandOccurrences(
      { amount: m("100.00"), frequency: "monthly", startDate: d("2026-01-01") },
      d("2026-02-01"),
      d("2026-03-15"),
    );
    expect(occurrences.map((o) => o.date.toString())).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("respects endDate", () => {
    const occurrences = expandOccurrences(
      { amount: m("100.00"), frequency: "monthly", startDate: d("2026-01-01"), endDate: d("2026-02-15") },
      d("2026-01-01"),
      d("2026-12-31"),
    );
    expect(occurrences.map((o) => o.date.toString())).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("annual inflation compounds once per anniversary year, independent of frequency", () => {
    const occurrences = expandOccurrences(
      {
        amount: m("1000.00"),
        frequency: "monthly",
        startDate: d("2026-01-01"),
        inflationRule: { type: "annual", rate: Decimal.fromString("0.10") },
      },
      d("2026-01-01"),
      d("2028-06-01"),
    );
    const jan2026 = occurrences.find((o) => o.date.toString() === "2026-01-01")!;
    const jan2027 = occurrences.find((o) => o.date.toString() === "2027-01-01")!;
    const dec2027 = occurrences.find((o) => o.date.toString() === "2027-12-01")!;
    const jan2028 = occurrences.find((o) => o.date.toString() === "2028-01-01")!;
    expect(jan2026.amount.toDecimalString()).toBe("1000.00");
    expect(jan2027.amount.toDecimalString()).toBe("1100.00");
    expect(dec2027.amount.toDecimalString()).toBe("1100.00"); // still within the second year, no re-price yet
    expect(jan2028.amount.toDecimalString()).toBe("1210.00");
  });

  it("monthly_compounded inflation re-prices every calendar month", () => {
    const occurrences = expandOccurrences(
      {
        amount: m("1000.00"),
        frequency: "monthly",
        startDate: d("2026-01-01"),
        inflationRule: { type: "monthly_compounded", rate: Decimal.fromString("0.01") },
      },
      d("2026-01-01"),
      d("2026-04-01"),
    );
    expect(occurrences.map((o) => o.amount.toDecimalString())).toEqual([
      "1000.00", // month 0, no elapsed months yet
      "1010.00", // 1 elapsed month
      "1020.10", // 2 elapsed months
      "1030.30", // 3 elapsed months
    ]);
  });

  it("rejects horizonEnd before horizonStart", () => {
    expect(() =>
      expandOccurrences({ amount: m("1.00"), frequency: "monthly", startDate: d("2026-01-01") }, d("2026-02-01"), d("2026-01-01")),
    ).toThrow();
  });
});
