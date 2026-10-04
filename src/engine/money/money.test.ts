import { describe, expect, it } from "vitest";
import { Money, sumMoney } from "./money.js";
import { Decimal } from "./decimal.js";

describe("Money", () => {
  it("parses decimal strings to exact minor units", () => {
    expect(Money.fromDecimalString("10.23", "EUR").minorUnits).toBe(1023n);
    expect(Money.fromDecimalString("0.01", "EUR").minorUnits).toBe(1n);
    expect(Money.fromDecimalString("-5.5", "EUR").minorUnits).toBe(-550n);
  });

  it("handles zero-exponent currencies (JPY)", () => {
    expect(Money.fromDecimalString("1500", "JPY").minorUnits).toBe(1500n);
    expect(Money.fromDecimalString("1500", "JPY").toDecimalString()).toBe("1500");
  });

  it("round-trips toDecimalString", () => {
    expect(Money.fromMinorUnits(1023n, "EUR").toDecimalString()).toBe("10.23");
    expect(Money.fromMinorUnits(-5n, "EUR").toDecimalString()).toBe("-0.05");
  });

  it("rejects cross-currency arithmetic", () => {
    const eur = Money.fromDecimalString("10", "EUR");
    const usd = Money.fromDecimalString("10", "USD");
    expect(() => eur.add(usd)).toThrow(/currency mismatch/);
  });

  it("add/sub are exact, no float drift", () => {
    let total = Money.zero("EUR");
    for (let i = 0; i < 1000; i++) {
      total = total.add(Money.fromDecimalString("0.01", "EUR"));
    }
    expect(total.toDecimalString()).toBe("10.00");
  });

  it("classic float trap: 0.1 + 0.2 is exact here", () => {
    const sum = Money.fromDecimalString("0.10", "EUR").add(Money.fromDecimalString("0.20", "EUR"));
    expect(sum.minorUnits).toBe(30n);
    expect(sum.toDecimalString()).toBe("0.30");
  });

  it("allocate splits without creating or destroying money", () => {
    const total = Money.fromDecimalString("10.00", "EUR");
    const shares = total.allocate(3);
    expect(shares.map((s) => s.minorUnits)).toEqual([334n, 333n, 333n]);
    expect(sumMoney("EUR", shares).equals(total)).toBe(true);
  });

  it("allocate handles negative amounts without creating money", () => {
    const total = Money.fromDecimalString("-10.00", "EUR");
    const shares = total.allocate(3);
    expect(sumMoney("EUR", shares).equals(total)).toBe(true);
  });

  it("mulFraction rounds deterministically (half-even)", () => {
    const m = Money.fromMinorUnits(5n, "EUR"); // 0.05
    expect(m.mulFraction(1n, 2n, "half-even").minorUnits).toBe(2n); // 2.5 -> 2 (even)
    expect(m.mulFraction(3n, 2n, "half-even").minorUnits).toBe(8n); // 7.5 -> 8 (even)
  });

  it("mulDecimal applies a rate factor exactly", () => {
    const principal = Money.fromDecimalString("100000.00", "EUR");
    const rate = Decimal.fromString("0.035"); // 3.5%
    expect(principal.mulDecimal(rate).toDecimalString()).toBe("3500.00");
  });

  it("compare/min/max/abs", () => {
    const a = Money.fromDecimalString("5.00", "EUR");
    const b = Money.fromDecimalString("-3.00", "EUR");
    expect(a.compare(b)).toBe(1);
    expect(a.min(b).equals(b)).toBe(true);
    expect(a.max(b).equals(a)).toBe(true);
    expect(b.abs().equals(Money.fromDecimalString("3.00", "EUR"))).toBe(true);
  });

  it("rejects unknown currency", () => {
    expect(() => Money.fromDecimalString("10", "XXX")).toThrow(/Unknown currency/);
  });
});
