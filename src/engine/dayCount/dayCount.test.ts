import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Decimal } from "../money/decimal.js";
import { yearFraction, actualDays, accrualFraction } from "./dayCount.js";

describe("yearFraction", () => {
  it("actual/365 over a non-leap full year is exactly 1", () => {
    const start = IsoDate.fromString("2026-01-01");
    const end = IsoDate.fromString("2027-01-01");
    expect(yearFraction(start, end, "actual/365").toString()).toBe("1");
  });

  it("actual/360 counts real days over 360", () => {
    const start = IsoDate.fromString("2026-01-01");
    const end = IsoDate.fromString("2026-02-01"); // 31 actual days
    expect(yearFraction(start, end, "actual/360").toString()).toBe(
      Decimal.fromFraction(31n, 360n).toString(),
    );
  });

  it("actual/365 over a leap-year Feb is 29/365", () => {
    const start = IsoDate.fromString("2024-02-01");
    const end = IsoDate.fromString("2024-03-01");
    expect(actualDays(start, end)).toBe(29);
    expect(yearFraction(start, end, "actual/365").toString()).toBe(
      Decimal.fromFraction(29n, 365n).toString(),
    );
  });

  it("30/360 treats every month as 30 days", () => {
    const start = IsoDate.fromString("2026-01-01");
    const end = IsoDate.fromString("2026-02-01");
    expect(yearFraction(start, end, "30/360").toString()).toBe(
      Decimal.fromFraction(30n, 360n).toString(),
    );
  });

  it("30/360 full year is exactly 1", () => {
    const start = IsoDate.fromString("2026-01-01");
    const end = IsoDate.fromString("2027-01-01");
    expect(yearFraction(start, end, "30/360").toString()).toBe("1");
  });

  it("30/360 clamps day-31 start to 30", () => {
    const start = IsoDate.fromString("2026-01-31");
    const end = IsoDate.fromString("2026-02-28");
    // d1=30 (clamped), d2=28 -> 30*(2-1) + (28-30) = 30 - 2 = 28 days
    expect(yearFraction(start, end, "30/360").toString()).toBe(
      Decimal.fromFraction(28n, 360n).toString(),
    );
  });

  it("30/360 clamps day-31 end to 30 when start is also day-30/31", () => {
    const start = IsoDate.fromString("2026-01-30");
    const end = IsoDate.fromString("2026-03-31");
    // d1=30, d2=30 (clamped since d1===30) -> 30*(3-1) + (30-30) = 60 days
    expect(yearFraction(start, end, "30/360").toString()).toBe(
      Decimal.fromFraction(60n, 360n).toString(),
    );
  });

  it("rejects end before start", () => {
    const start = IsoDate.fromString("2026-02-01");
    const end = IsoDate.fromString("2026-01-01");
    expect(() => yearFraction(start, end, "actual/365")).toThrow();
  });

  it("zero-length period yields zero fraction", () => {
    const d = IsoDate.fromString("2026-01-01");
    expect(yearFraction(d, d, "actual/365").isZero()).toBe(true);
    expect(yearFraction(d, d, "30/360").isZero()).toBe(true);
  });
});

describe("accrualFraction", () => {
  it("multiplies annual rate by year fraction", () => {
    const start = IsoDate.fromString("2026-01-01");
    const end = IsoDate.fromString("2026-07-01"); // 181 actual days
    const rate = Decimal.fromString("0.05");
    const expected = rate.mul(Decimal.fromFraction(181n, 365n));
    expect(accrualFraction(start, end, "actual/365", rate).toString()).toBe(expected.toString());
  });
});
