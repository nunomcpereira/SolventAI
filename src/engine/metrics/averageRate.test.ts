import { describe, expect, it } from "vitest";
import { Decimal } from "../money/decimal.js";
import { currentAnnualRate, weightedAverageRate } from "./averageRate.js";

const d = (value: string) => Decimal.fromString(value);

const mixed = {
  type: "mixed" as const,
  fixedAnnualRate: d("0.03"),
  fixedPeriodCount: 36,
  index: "EURIBOR_6M",
  currentIndexRate: d("0.022"),
  spread: d("0.007"),
  resetFrequency: "semiannual" as const,
};

describe("currentAnnualRate", () => {
  it("returns the fixed rate of a fixed loan", () => {
    expect(currentAnnualRate({ type: "fixed", annualRate: d("0.035") }, 100).toString()).toBe(d("0.035").toString());
  });

  it("uses the fixed leg of a mixed loan until the fixed period ends, then index + spread", () => {
    expect(currentAnnualRate(mixed, 0).toString()).toBe(d("0.03").toString());
    expect(currentAnnualRate(mixed, 35).toString()).toBe(d("0.03").toString());
    expect(currentAnnualRate(mixed, 36).toString()).toBe(d("0.029").toString());
  });

  it("applies cap and floor to the variable leg", () => {
    const variable = {
      type: "variable" as const,
      index: "EURIBOR_6M",
      currentIndexRate: d("0.05"),
      spread: d("0.01"),
      resetFrequency: "semiannual" as const,
      rateCap: d("0.045"),
    };
    expect(currentAnnualRate(variable, 0).toString()).toBe(d("0.045").toString());
    expect(
      currentAnnualRate({ ...variable, currentIndexRate: d("-0.01"), rateCap: undefined, rateFloor: d("0.005") } as never, 0).toString(),
    ).toBe(d("0.005").toString());
  });
});

describe("weightedAverageRate", () => {
  it("weights each rate by its outstanding balance", () => {
    const avg = weightedAverageRate([
      { balanceMinorUnits: 30000000n, annualRate: d("0.03") },
      { balanceMinorUnits: 10000000n, annualRate: d("0.07") },
    ]);
    expect(avg?.toString()).toBe(d("0.04").toString());
  });

  it("ignores fully repaid loans and returns undefined when nothing is owed", () => {
    expect(weightedAverageRate([{ balanceMinorUnits: 0n, annualRate: d("0.09") }])).toBeUndefined();
    expect(weightedAverageRate([])).toBeUndefined();
    expect(
      weightedAverageRate([
        { balanceMinorUnits: 0n, annualRate: d("0.09") },
        { balanceMinorUnits: 100n, annualRate: d("0.02") },
      ])?.toString(),
    ).toBe(d("0.02").toString());
  });
});
