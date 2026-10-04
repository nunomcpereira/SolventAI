import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal.js";

describe("Decimal", () => {
  it("parses and stringifies exactly", () => {
    expect(Decimal.fromString("0.035").toString()).toBe("0.035");
    expect(Decimal.fromString("-12.5").toString()).toBe("-12.5");
    expect(Decimal.fromString("7").toString()).toBe("7");
  });

  it("add/sub/mul/div are exact for typical rate math", () => {
    const a = Decimal.fromString("1.02");
    const b = Decimal.fromString("1.03");
    expect(a.mul(b).toString()).toBe("1.0506");
  });

  it("div gives 18 significant fractional digits (1/365 is not exact in any finite base)", () => {
    const annualRate = Decimal.fromString("0.05");
    const daily = annualRate.div(Decimal.fromBigInt(365n));
    // Re-multiplying can't recover the exact original value from an inexact quotient;
    // this documents the expected magnitude of that residual, not a bug.
    const roundTripped = daily.mul(Decimal.fromBigInt(365n));
    expect(roundTripped.toString()).toBe("0.049999999999999995");
  });

  it("exact fraction division (evenly divisible) has zero residual", () => {
    const a = Decimal.fromString("1.00");
    const quarter = a.div(Decimal.fromBigInt(4n));
    expect(quarter.mul(Decimal.fromBigInt(4n)).toString()).toBe("1");
  });

  it("rejects malformed literals", () => {
    expect(() => Decimal.fromString("abc")).toThrow();
    expect(() => Decimal.fromString("1.2.3")).toThrow();
  });

  it("pow computes exact integer powers", () => {
    expect(Decimal.fromString("1.1").pow(0).toString()).toBe("1");
    expect(Decimal.fromString("1.1").pow(2).toString()).toBe("1.21");
    expect(Decimal.fromString("2").pow(10).toString()).toBe("1024");
  });

  it("reciprocal is the multiplicative inverse", () => {
    const x = Decimal.fromString("4");
    expect(x.reciprocal().toString()).toBe("0.25");
    expect(x.mul(x.reciprocal()).toString()).toBe("1");
  });

  it("compare/min/max", () => {
    const a = Decimal.fromString("1.5");
    const b = Decimal.fromString("2.5");
    expect(a.compare(b)).toBe(-1);
    expect(a.min(b).toString()).toBe("1.5");
    expect(a.max(b).toString()).toBe("2.5");
  });
});
