import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Decimal } from "../money/decimal.js";
import { resolveEffectiveRate, resetDatesInRange, type FixedRate, type VariableRate, type IndexFixing } from "./rate.js";

describe("resolveEffectiveRate", () => {
  it("fixed rate is constant regardless of date", () => {
    const rate: FixedRate = { type: "fixed", annualRate: Decimal.fromString("0.035") };
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2030-01-01"), []).toString()).toBe("0.035");
  });

  it("variable rate = latest fixing on/before asOfDate + spread", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "EURIBOR_6M",
      currentIndexRate: Decimal.fromString("0.02"),
      spread: Decimal.fromString("0.01"),
      resetFrequency: "semiannual",
    };
    const fixings: IndexFixing[] = [
      { index: "EURIBOR_6M", effectiveDate: IsoDate.fromString("2026-01-01"), annualValue: Decimal.fromString("0.02") },
      { index: "EURIBOR_6M", effectiveDate: IsoDate.fromString("2026-07-01"), annualValue: Decimal.fromString("0.025") },
    ];
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-03-01"), fixings).toString()).toBe("0.03");
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-08-01"), fixings).toString()).toBe("0.035");
  });

  it("applies rate cap", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "SOFR",
      currentIndexRate: Decimal.fromString("0.03"),
      spread: Decimal.fromString("0.02"),
      resetFrequency: "monthly",
      rateCap: Decimal.fromString("0.06"),
    };
    const fixings: IndexFixing[] = [
      { index: "SOFR", effectiveDate: IsoDate.fromString("2026-01-01"), annualValue: Decimal.fromString("0.10") },
    ];
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-02-01"), fixings).toString()).toBe("0.06");
  });

  it("applies rate floor", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "SOFR",
      currentIndexRate: Decimal.fromString("0.01"),
      spread: Decimal.fromString("0.01"),
      resetFrequency: "monthly",
      rateFloor: Decimal.fromString("0.02"),
    };
    const fixings: IndexFixing[] = [
      { index: "SOFR", effectiveDate: IsoDate.fromString("2026-01-01"), annualValue: Decimal.fromString("0.001") },
    ];
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-02-01"), fixings).toString()).toBe("0.02");
  });

  it("falls back to currentIndexRate when no fixing exists", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "PRIME",
      currentIndexRate: Decimal.fromString("0.045"),
      spread: Decimal.fromString("0.005"),
      resetFrequency: "monthly",
    };
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-01-01"), []).toString()).toBe("0.05");
  });

  it("ignores fixings for a different index and still uses currentIndexRate", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "PRIME",
      currentIndexRate: Decimal.fromString("0.04"),
      spread: Decimal.fromString("0.005"),
      resetFrequency: "monthly",
    };
    const fixings: IndexFixing[] = [
      { index: "SOFR", effectiveDate: IsoDate.fromString("2026-01-01"), annualValue: Decimal.fromString("0.05") },
    ];
    expect(resolveEffectiveRate(rate, IsoDate.fromString("2026-02-01"), fixings).toString()).toBe("0.045");
  });
});

describe("resetDatesInRange", () => {
  it("fixed rate never resets", () => {
    const rate: FixedRate = { type: "fixed", annualRate: Decimal.fromString("0.03") };
    expect(resetDatesInRange(rate, IsoDate.fromString("2026-01-01"), IsoDate.fromString("2027-01-01"))).toEqual([]);
  });

  it("variable rate resets per resetFrequency", () => {
    const rate: VariableRate = {
      type: "variable",
      index: "EURIBOR_6M",
      currentIndexRate: Decimal.fromString("0.02"),
      spread: Decimal.fromString("0.01"),
      resetFrequency: "semiannual",
    };
    const dates = resetDatesInRange(rate, IsoDate.fromString("2026-01-01"), IsoDate.fromString("2027-01-01")).map((d) =>
      d.toString(),
    );
    expect(dates).toEqual(["2026-01-01", "2026-07-01", "2027-01-01"]);
  });
});
