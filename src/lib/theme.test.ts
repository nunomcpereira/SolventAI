import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme } from "./theme.js";

describe("parseTheme", () => {
  it("accepts known themes", () => {
    expect(parseTheme("classic")).toBe("classic");
    expect(parseTheme("ledger")).toBe("ledger");
  });

  it("falls back to the default for missing or unknown values", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme("neon")).toBe(DEFAULT_THEME);
  });
});
