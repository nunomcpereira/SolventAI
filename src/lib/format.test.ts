import { describe, expect, it } from "vitest";
import { formatDate, formatMonthTick, monthStartsBetween } from "./format.js";

describe("calendar date formatting", () => {
  it("prints the stated day and month regardless of the machine's timezone", () => {
    // Formatting is pinned to UTC, so this holds under any TZ the tests run in.
    expect(formatDate("2026-10-01", "en")).toBe("Oct 01, 2026");
    expect(formatMonthTick("2026-10-01", "en")).toBe("Oct 26");
  });
});

describe("monthStartsBetween", () => {
  it("returns the first of each month inside the range", () => {
    expect(monthStartsBetween("2026-08-09", "2026-11-07")).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
  });

  it("includes the start when it is already a month start, and crosses years", () => {
    expect(monthStartsBetween("2026-12-01", "2027-02-15")).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
  });

  it("is empty for a range inside one month or an inverted range", () => {
    expect(monthStartsBetween("2026-10-02", "2026-10-30")).toEqual([]);
    expect(monthStartsBetween("2026-11-01", "2026-10-01")).toEqual([]);
  });
});
