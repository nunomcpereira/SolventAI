import { describe, expect, it } from "vitest";
import { roundDiv } from "./rounding.js";

describe("roundDiv", () => {
  it("half-up rounds .5 away from zero", () => {
    expect(roundDiv(5n, 2n, "half-up")).toBe(3n);
    expect(roundDiv(-5n, 2n, "half-up")).toBe(-3n);
  });

  it("half-even rounds .5 to nearest even", () => {
    expect(roundDiv(5n, 2n, "half-even")).toBe(2n);
    expect(roundDiv(7n, 2n, "half-even")).toBe(4n);
    expect(roundDiv(-5n, 2n, "half-even")).toBe(-2n);
  });

  it("down truncates toward zero magnitude", () => {
    expect(roundDiv(9n, 4n, "down")).toBe(2n);
    expect(roundDiv(-9n, 4n, "down")).toBe(-2n);
  });

  it("up rounds any remainder away from zero", () => {
    expect(roundDiv(9n, 4n, "up")).toBe(3n);
    expect(roundDiv(-9n, 4n, "up")).toBe(-3n);
  });

  it("exact division has no rounding ambiguity across modes", () => {
    for (const mode of ["half-up", "half-even", "down", "up"] as const) {
      expect(roundDiv(8n, 4n, mode)).toBe(2n);
    }
  });

  it("rejects non-positive denominator", () => {
    expect(() => roundDiv(1n, 0n)).toThrow();
    expect(() => roundDiv(1n, -1n)).toThrow();
  });
});
