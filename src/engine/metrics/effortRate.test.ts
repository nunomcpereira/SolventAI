import { describe, expect, it } from "vitest";
import { Money } from "../money/money.js";
import { computeEffortRate } from "./effortRate.js";

const m = (s: string) => Money.fromDecimalString(s, "EUR");

describe("computeEffortRate", () => {
  it("computes the correct percentage for a known ratio", () => {
    const rate = computeEffortRate(m("900.00"), m("3000.00"));
    expect(rate.toString()).toBe("30");
  });

  it("throws for non-positive income", () => {
    expect(() => computeEffortRate(m("100.00"), m("0.00"))).toThrow();
    expect(() => computeEffortRate(m("100.00"), m("-1.00"))).toThrow();
  });

  it("throws on currency mismatch", () => {
    expect(() => computeEffortRate(m("100.00"), Money.fromDecimalString("100.00", "USD"))).toThrow();
  });
});
