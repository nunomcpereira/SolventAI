import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { applyPrepayment, type PrepaymentInput } from "./prepayment.js";

function baseSchedule(overrides: Partial<PrepaymentInput["originalSchedule"]> = {}) {
  return {
    principal: Money.fromDecimalString("100000.00", "EUR"),
    startDate: IsoDate.fromString("2026-01-01"),
    numberOfPeriods: 24,
    paymentFrequency: "monthly" as const,
    dayCountConvention: "30/360" as const,
    amortizationType: "french" as const,
    annualRateForPeriod: () => Decimal.fromString("0.06"),
    ...overrides,
  };
}

describe("applyPrepayment — reduce_payment", () => {
  it("keeps the same total period count and fully amortizes", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 6,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "reduce_payment",
      penaltyRule: { type: "none" },
    });
    expect(result.newSchedule).toHaveLength(24);
    expect(result.newSchedule[result.newSchedule.length - 1]!.closingPrincipal.isZero()).toBe(true);
  });

  it("numbers periods continuously with no collisions or gaps across the elapsed/recomputed boundary", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 6,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "reduce_payment",
      penaltyRule: { type: "none" },
    });
    expect(result.newSchedule.map((e) => e.period)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it("reduces principal by the prepayment amount, saves positive interest", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 6,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "reduce_payment",
      penaltyRule: { type: "none" },
    });
    const openingAtPeriod7 = result.originalSchedule[6]!.openingPrincipal;
    expect(result.principalAfterPrepayment.equals(openingAtPeriod7.sub(Money.fromDecimalString("10000.00", "EUR")))).toBe(
      true,
    );
    expect(result.interestSaved.isPositive()).toBe(true);
  });

  it("computes penalty and totalCashOutflow", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 0,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "reduce_payment",
      penaltyRule: { type: "percentage", rate: Decimal.fromString("0.005") },
    });
    expect(result.penalty.toDecimalString()).toBe("50.00");
    expect(result.totalCashOutflow.toDecimalString()).toBe("10050.00");
  });

  it("caps prepayment at outstanding principal (never creates negative principal)", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule({ numberOfPeriods: 3 }),
      periodsElapsed: 0,
      prepaymentAmount: Money.fromDecimalString("999999.00", "EUR"),
      strategy: "reduce_payment",
      penaltyRule: { type: "none" },
    });
    expect(result.principalAfterPrepayment.isZero()).toBe(true);
    expect(result.newSchedule).toHaveLength(0);
  });
});

describe("applyPrepayment — shorten_term", () => {
  it("pays off in fewer or equal periods than the original schedule", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 6,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      strategy: "shorten_term",
      penaltyRule: { type: "none" },
    });
    expect(result.newSchedule.length).toBeLessThanOrEqual(24);
    expect(result.newSchedule[result.newSchedule.length - 1]!.closingPrincipal.isZero()).toBe(true);
    expect(result.interestSaved.isPositive()).toBe(true);
  });

  it("saves at least as much interest as reduce_payment for the same prepayment", () => {
    const shared = {
      originalSchedule: baseSchedule(),
      periodsElapsed: 6,
      prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
      penaltyRule: { type: "none" as const },
    };
    const reduced = applyPrepayment({ ...shared, strategy: "reduce_payment" });
    const shortened = applyPrepayment({ ...shared, strategy: "shorten_term" });
    expect(shortened.interestSaved.compare(reduced.interestSaved)).toBeGreaterThanOrEqual(0);
  });

  it("throws for interest_only loans (no payment to hold constant)", () => {
    expect(() =>
      applyPrepayment({
        originalSchedule: baseSchedule({ amortizationType: "interest_only" }),
        periodsElapsed: 6,
        prepaymentAmount: Money.fromDecimalString("10000.00", "EUR"),
        strategy: "shorten_term",
        penaltyRule: { type: "none" },
      }),
    ).toThrow(/interest-only/);
  });

  it("works when prepayment happens before period 1 (periodsElapsed=0)", () => {
    const result = applyPrepayment({
      originalSchedule: baseSchedule(),
      periodsElapsed: 0,
      prepaymentAmount: Money.fromDecimalString("5000.00", "EUR"),
      strategy: "shorten_term",
      penaltyRule: { type: "none" },
    });
    expect(result.newSchedule[result.newSchedule.length - 1]!.closingPrincipal.isZero()).toBe(true);
  });
});

describe("applyPrepayment — validation", () => {
  it("rejects non-positive prepayment amount", () => {
    expect(() =>
      applyPrepayment({
        originalSchedule: baseSchedule(),
        periodsElapsed: 0,
        prepaymentAmount: Money.zero("EUR"),
        strategy: "reduce_payment",
        penaltyRule: { type: "none" },
      }),
    ).toThrow();
  });

  it("rejects periodsElapsed out of range", () => {
    expect(() =>
      applyPrepayment({
        originalSchedule: baseSchedule({ numberOfPeriods: 5 }),
        periodsElapsed: 5,
        prepaymentAmount: Money.fromDecimalString("100.00", "EUR"),
        strategy: "reduce_payment",
        penaltyRule: { type: "none" },
      }),
    ).toThrow();
  });
});
