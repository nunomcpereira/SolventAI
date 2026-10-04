import { describe, expect, it } from "vitest";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { computePrepaymentPenalty } from "./penalty.js";

const m = (s: string) => Money.fromDecimalString(s, "EUR");

describe("computePrepaymentPenalty", () => {
  it("returns zero for type none", () => {
    expect(computePrepaymentPenalty({ type: "none" }, m("10000.00")).isZero()).toBe(true);
  });

  it("returns fixedAmount regardless of prepayment size", () => {
    const penalty = computePrepaymentPenalty({ type: "fixed", fixedAmount: m("50.00") }, m("10000.00"));
    expect(penalty.toDecimalString()).toBe("50.00");
  });

  it("computes percentage penalty", () => {
    const penalty = computePrepaymentPenalty({ type: "percentage", rate: Decimal.fromString("0.005") }, m("10000.00"));
    expect(penalty.toDecimalString()).toBe("50.00");
  });

  it("caps percentage penalty at maximumPenalty", () => {
    const penalty = computePrepaymentPenalty(
      { type: "percentage", rate: Decimal.fromString("0.02"), maximumPenalty: m("100.00") },
      m("10000.00"),
    );
    expect(penalty.toDecimalString()).toBe("100.00");
  });
});
