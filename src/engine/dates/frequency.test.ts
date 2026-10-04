import { describe, expect, it } from "vitest";
import { IsoDate } from "./isoDate.js";
import { generatePeriodDates, countPeriodsBetween } from "./frequency.js";

describe("generatePeriodDates", () => {
  it("generates monthly dates, exclusive of start", () => {
    const start = IsoDate.fromString("2026-01-15");
    const dates = generatePeriodDates(start, "monthly", 3).map((d) => d.toString());
    expect(dates).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("generates weekly dates", () => {
    const start = IsoDate.fromString("2026-01-01");
    const dates = generatePeriodDates(start, "weekly", 2).map((d) => d.toString());
    expect(dates).toEqual(["2026-01-08", "2026-01-15"]);
  });

  it("clamps end-of-month across months with fewer days", () => {
    const start = IsoDate.fromString("2026-01-31");
    const dates = generatePeriodDates(start, "monthly", 2).map((d) => d.toString());
    expect(dates).toEqual(["2026-02-28", "2026-03-28"]); // clamp persists per-step, not re-anchored
  });

  it("returns empty array for count=0", () => {
    expect(generatePeriodDates(IsoDate.fromString("2026-01-01"), "monthly", 0)).toEqual([]);
  });

  it("rejects negative count", () => {
    expect(() => generatePeriodDates(IsoDate.fromString("2026-01-01"), "monthly", -1)).toThrow();
  });
});

describe("countPeriodsBetween", () => {
  it("counts monthly periods consistent with generatePeriodDates", () => {
    const start = IsoDate.fromString("2026-01-15");
    const end = IsoDate.fromString("2026-04-15");
    expect(countPeriodsBetween(start, end, "monthly")).toBe(3);
  });

  it("returns 0 when start equals end", () => {
    const d = IsoDate.fromString("2026-01-15");
    expect(countPeriodsBetween(d, d, "monthly")).toBe(0);
  });

  it("rejects endDate before startDate", () => {
    const start = IsoDate.fromString("2026-04-15");
    const end = IsoDate.fromString("2026-01-15");
    expect(() => countPeriodsBetween(start, end, "monthly")).toThrow();
  });
});
