import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money, sumMoney } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { generateAmortizationSchedule, type AmortizationEntry } from "./amortization.js";

function assertReconciles(entries: AmortizationEntry[], currency: string) {
  for (const e of entries) {
    expect(e.openingPrincipal.sub(e.principal).equals(e.closingPrincipal)).toBe(true);
    expect(e.principal.add(e.interest).equals(e.scheduledPayment)).toBe(true);
    expect(e.scheduledPayment.add(e.fees).equals(e.totalCashOutflow)).toBe(true);
  }
  // chain: each period's closing == next period's opening
  for (let i = 1; i < entries.length; i++) {
    expect(entries[i - 1]!.closingPrincipal.equals(entries[i]!.openingPrincipal)).toBe(true);
  }
  const last = entries[entries.length - 1]!;
  expect(last.closingPrincipal.equals(Money.zero(currency))).toBe(true);
}

describe("generateAmortizationSchedule — zero-rate sanity (exact by hand)", () => {
  it("french at 0% degenerates to equal principal-only payments", () => {
    const principal = Money.fromDecimalString("12000.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "french",
      annualRateForPeriod: () => Decimal.ZERO,
    });
    assertReconciles(entries, "EUR");
    for (const e of entries) {
      expect(e.interest.isZero()).toBe(true);
      expect(e.principal.toDecimalString()).toBe("1000.00");
    }
  });
});

describe("generateAmortizationSchedule — french (constant payment)", () => {
  it("reconciles every period and pays off exactly, fixed rate", () => {
    const principal = Money.fromDecimalString("100000.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "french",
      annualRateForPeriod: () => Decimal.fromString("0.036"),
    });
    assertReconciles(entries, "EUR");

    const totalPrincipal = sumMoney("EUR", entries.map((e) => e.principal));
    expect(totalPrincipal.equals(principal)).toBe(true);

    // Payment amount should be near-constant across periods for a fixed rate (allow 1 cent for rounding).
    const payments = entries.map((e) => e.scheduledPayment.minorUnits);
    const maxPayment = payments.reduce((a, b) => (b > a ? b : a));
    const minPayment = payments.reduce((a, b) => (b < a ? b : a));
    expect(maxPayment - minPayment).toBeLessThanOrEqual(1n);

    // Interest declines monotonically as principal amortizes.
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.interest.compare(entries[i - 1]!.interest)).toBeLessThanOrEqual(0);
    }
  });

  it("reconciles and fully amortizes even with mid-schedule rate changes (variable rate)", () => {
    const principal = Money.fromDecimalString("50000.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 24,
      paymentFrequency: "monthly",
      dayCountConvention: "actual/365",
      amortizationType: "french",
      annualRateForPeriod: (periodIndex) => (periodIndex <= 12 ? Decimal.fromString("0.03") : Decimal.fromString("0.05")),
    });
    assertReconciles(entries, "EUR");
    const totalPrincipal = sumMoney("EUR", entries.map((e) => e.principal));
    expect(totalPrincipal.equals(principal)).toBe(true);
  });
});

describe("generateAmortizationSchedule — constant amortization", () => {
  it("constant principal repayment each period, declining interest and payment", () => {
    const principal = Money.fromDecimalString("12000.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "constant_amortization",
      annualRateForPeriod: () => Decimal.fromString("0.06"),
    });
    assertReconciles(entries, "EUR");
    for (const e of entries) {
      expect(e.principal.toDecimalString()).toBe("1000.00");
    }
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.interest.compare(entries[i - 1]!.interest)).toBeLessThan(0);
      expect(entries[i]!.scheduledPayment.compare(entries[i - 1]!.scheduledPayment)).toBeLessThan(0);
    }
  });
});

describe("generateAmortizationSchedule — interest only", () => {
  it("zero principal repayment until final period, which repays it all", () => {
    const principal = Money.fromDecimalString("20000.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 6,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "interest_only",
      annualRateForPeriod: () => Decimal.fromString("0.04"),
    });
    assertReconciles(entries, "EUR");
    for (const e of entries.slice(0, -1)) {
      expect(e.principal.isZero()).toBe(true);
      expect(e.interest.isZero()).toBe(false);
    }
    const last = entries[entries.length - 1]!;
    expect(last.principal.equals(principal)).toBe(true);
  });
});

describe("generateAmortizationSchedule — fees", () => {
  it("adds per-period fee to totalCashOutflow but not to scheduledPayment", () => {
    const principal = Money.fromDecimalString("10000.00", "EUR");
    const fee = Money.fromDecimalString("5.00", "EUR");
    const entries = generateAmortizationSchedule({
      principal,
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 3,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "french",
      annualRateForPeriod: () => Decimal.fromString("0.02"),
      feeForPeriod: () => fee,
    });
    assertReconciles(entries, "EUR");
    for (const e of entries) {
      expect(e.fees.equals(fee)).toBe(true);
      expect(e.totalCashOutflow.equals(e.scheduledPayment.add(fee))).toBe(true);
    }
  });
});

describe("generateAmortizationSchedule — validation", () => {
  it("rejects non-positive numberOfPeriods", () => {
    expect(() =>
      generateAmortizationSchedule({
        principal: Money.fromDecimalString("1000.00", "EUR"),
        startDate: IsoDate.fromString("2026-01-01"),
        numberOfPeriods: 0,
        paymentFrequency: "monthly",
        dayCountConvention: "30/360",
        amortizationType: "french",
        annualRateForPeriod: () => Decimal.ZERO,
      }),
    ).toThrow();
  });
});
