import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EuriborParseError, euriborTenorOf, parseEuriborTable, percentToDecimalString } from "./euribor.js";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/euribor-table.html", import.meta.url)), "utf-8");

describe("parseEuriborTable", () => {
  it("reads the most recent column of the euribor-rates.eu table", () => {
    expect(parseEuriborTable(fixture)).toEqual({
      asOf: "2026-11-06",
      rates: { "1W": "0.02392", "1M": "0.02473", "3M": "0.02794", "6M": "0.03016", "12M": "0.03248" },
    });
  });

  it("refuses to guess when the page layout changed", () => {
    expect(() => parseEuriborTable("<html><body>Maintenance</body></html>")).toThrow(EuriborParseError);
    expect(() => parseEuriborTable("<table><thead><tr><th>Rates</th></tr></thead></table>")).toThrow(/date header/);
    const garbled = fixture.replace("3.016 %", "n/a");
    expect(() => parseEuriborTable(garbled)).toThrow(/Euribor 6M/);
  });
});

describe("percentToDecimalString", () => {
  it("converts exactly, without float rounding", () => {
    expect(percentToDecimalString("2.392 %")).toBe("0.02392");
    expect(percentToDecimalString("3,016%")).toBe("0.03016");
    expect(percentToDecimalString("12.5 %")).toBe("0.125");
    expect(percentToDecimalString("0 %")).toBe("0");
    expect(percentToDecimalString("-0.512 %")).toBe("-0.00512");
    expect(percentToDecimalString("n/a")).toBeUndefined();
  });
});

describe("euriborTenorOf", () => {
  it.each([
    ["EURIBOR_6M", "6M"],
    ["EURIBOR_12M", "12M"],
    ["Euribor 6 months", "6M"],
    ["Euribor a 6 meses", "6M"],
    ["euribor 3 meses", "3M"],
    ["Euribor 12 Monate", "12M"],
    ["Euribor 1 semaine", "1W"],
    ["EURIBOR 1M", "1M"],
  ])("%s -> %s", (name, tenor) => {
    expect(euriborTenorOf(name)).toBe(tenor);
  });

  it("ignores other indexes and unknown tenors", () => {
    expect(euriborTenorOf("SOFR")).toBeUndefined();
    expect(euriborTenorOf("PRIME")).toBeUndefined();
    expect(euriborTenorOf("Euribor 9 months")).toBeUndefined();
    expect(euriborTenorOf("Euribor")).toBeUndefined();
  });
});
