import { describe, expect, it } from "vitest";
import { IsoDate, isLeapYear, daysInMonth, daysInYear } from "./isoDate.js";

describe("IsoDate", () => {
  it("parses and stringifies YYYY-MM-DD", () => {
    expect(IsoDate.fromString("2026-08-09").toString()).toBe("2026-08-09");
    expect(IsoDate.fromString("2026-01-01").toString()).toBe("2026-01-01");
  });

  it("rejects malformed strings", () => {
    expect(() => IsoDate.fromString("2026-8-9")).toThrow();
    expect(() => IsoDate.fromString("not-a-date")).toThrow();
  });

  it("rejects invalid calendar dates", () => {
    expect(() => IsoDate.fromParts(2026, 2, 30)).toThrow();
    expect(() => IsoDate.fromParts(2026, 13, 1)).toThrow();
    expect(() => IsoDate.fromParts(2025, 2, 29)).toThrow(); // not a leap year
  });

  it("identifies leap years correctly (Gregorian rule)", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
  });

  it("daysInMonth / daysInYear respect leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2023)).toBe(365);
  });

  it("addDays crosses month/year boundaries correctly", () => {
    expect(IsoDate.fromString("2026-01-31").addDays(1).toString()).toBe("2026-02-01");
    expect(IsoDate.fromString("2025-12-31").addDays(1).toString()).toBe("2026-01-01");
    expect(IsoDate.fromString("2024-02-28").addDays(1).toString()).toBe("2024-02-29");
  });

  it("addMonths clamps day to target month length", () => {
    expect(IsoDate.fromString("2026-01-31").addMonths(1).toString()).toBe("2026-02-28");
    expect(IsoDate.fromString("2024-01-31").addMonths(1).toString()).toBe("2024-02-29");
    expect(IsoDate.fromString("2026-01-31").addMonths(2).toString()).toBe("2026-03-31");
  });

  it("addMonths crosses year boundary and handles negative months", () => {
    expect(IsoDate.fromString("2026-11-15").addMonths(3).toString()).toBe("2027-02-15");
    expect(IsoDate.fromString("2026-02-15").addMonths(-3).toString()).toBe("2025-11-15");
  });

  it("addYears", () => {
    expect(IsoDate.fromString("2024-02-29").addYears(1).toString()).toBe("2025-02-28");
  });

  it("compare/isBefore/isAfter/equals", () => {
    const a = IsoDate.fromString("2026-01-01");
    const b = IsoDate.fromString("2026-06-01");
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
    expect(a.equals(IsoDate.fromString("2026-01-01"))).toBe(true);
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
  });

  it("daysUntil counts whole calendar days", () => {
    const a = IsoDate.fromString("2026-01-01");
    const b = IsoDate.fromString("2026-01-31");
    expect(a.daysUntil(b)).toBe(30);
    expect(b.daysUntil(a)).toBe(-30);
  });

  it("epoch day round-trips through fromEpochDay", () => {
    const a = IsoDate.fromString("2026-08-09");
    const roundTripped = IsoDate.fromEpochDay(a.toEpochDay());
    expect(roundTripped.equals(a)).toBe(true);
  });

  it("epoch day is stable across a wide date range (1900-2100)", () => {
    for (const dateStr of ["1900-03-01", "1999-12-31", "2000-01-01", "2038-01-19", "2100-02-28"]) {
      const d = IsoDate.fromString(dateStr);
      expect(IsoDate.fromEpochDay(d.toEpochDay()).toString()).toBe(dateStr);
    }
  });
});
