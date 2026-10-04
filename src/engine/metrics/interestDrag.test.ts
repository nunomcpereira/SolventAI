import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Decimal } from "../money/decimal.js";
import { generateAmortizationSchedule } from "../amortization/amortization.js";
import { computeInterestDrag } from "./interestDrag.js";
import { Money } from "../money/money.js";

describe("computeInterestDrag", () => {
  it("is exactly 0 for a zero-rate loan (all payment is principal)", () => {
    const entries = generateAmortizationSchedule({
      principal: Money.fromDecimalString("12000.00", "EUR"),
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "french",
      annualRateForPeriod: () => Decimal.ZERO,
    });
    expect(computeInterestDrag("EUR", entries).toString()).toBe("0");
  });

  it("is between 0 and 1 for a normal interest-bearing loan", () => {
    const entries = generateAmortizationSchedule({
      principal: Money.fromDecimalString("100000.00", "EUR"),
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "french",
      annualRateForPeriod: () => Decimal.fromString("0.06"),
    });
    const drag = computeInterestDrag("EUR", entries);
    expect(drag.isNegative()).toBe(false);
    expect(drag.compare(Decimal.ONE)).toBeLessThan(0);
  });

  it("interest-only loan: drag is exactly 1 before the balloon payoff period", () => {
    const entries = generateAmortizationSchedule({
      principal: Money.fromDecimalString("100000.00", "EUR"),
      startDate: IsoDate.fromString("2026-01-01"),
      numberOfPeriods: 12,
      paymentFrequency: "monthly",
      dayCountConvention: "30/360",
      amortizationType: "interest_only",
      annualRateForPeriod: () => Decimal.fromString("0.06"),
    });
    // Every period before the final balloon payoff is pure interest: principal repayment is zero,
    // so scheduledPayment === interest and the ratio is exactly 1.
    const beforeBalloon = entries.slice(0, -1);
    expect(computeInterestDrag("EUR", beforeBalloon).toString()).toBe("1");
  });

  it("throws when total scheduled payment is zero", () => {
    expect(() => computeInterestDrag("EUR", [])).toThrow();
  });
});
