import { describe, expect, it } from "vitest";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { parseExchangeRate, serializeExchangeRate, findApplicableRate } from "./exchangeRate.js";
import { DomainValidationError } from "../shared/errors.js";

function validRaw() {
  return { id: "fx-1", fromCurrency: "USD", toCurrency: "EUR", rate: "0.92", effectiveDate: "2026-01-01" };
}

describe("parseExchangeRate", () => {
  it("parses a valid rate", () => {
    const rate = parseExchangeRate(validRaw());
    expect(rate.rate.toString()).toBe("0.92");
  });

  it("round-trips through serializeExchangeRate", () => {
    const rate = parseExchangeRate(validRaw());
    expect(parseExchangeRate(serializeExchangeRate(rate))).toEqual(rate);
  });

  it("rejects fromCurrency === toCurrency", () => {
    expect(() => parseExchangeRate({ ...validRaw(), toCurrency: "USD" })).toThrow(DomainValidationError);
  });

  it("rejects zero or negative rate", () => {
    expect(() => parseExchangeRate({ ...validRaw(), rate: "0" })).toThrow(DomainValidationError);
    expect(() => parseExchangeRate({ ...validRaw(), rate: "-1" })).toThrow(DomainValidationError);
  });

  it("rejects unknown currency", () => {
    expect(() => parseExchangeRate({ ...validRaw(), fromCurrency: "XXX" })).toThrow(DomainValidationError);
  });
});

describe("findApplicableRate", () => {
  it("returns the most recent rate on/before asOfDate", () => {
    const rates = [
      parseExchangeRate({ ...validRaw(), id: "fx-1", effectiveDate: "2026-01-01", rate: "0.90" }),
      parseExchangeRate({ ...validRaw(), id: "fx-2", effectiveDate: "2026-06-01", rate: "0.95" }),
    ];
    const found = findApplicableRate(rates, "USD", "EUR", IsoDate.fromString("2026-08-01"));
    expect(found?.id).toBe("fx-2");
  });

  it("returns undefined when no applicable rate exists (never invents one)", () => {
    const rates = [parseExchangeRate({ ...validRaw(), effectiveDate: "2026-06-01" })];
    const found = findApplicableRate(rates, "USD", "EUR", IsoDate.fromString("2026-01-01"));
    expect(found).toBeUndefined();
  });

  it("ignores rates for a different currency pair", () => {
    const rates = [parseExchangeRate({ ...validRaw(), fromCurrency: "GBP" })];
    const found = findApplicableRate(rates, "USD", "EUR", IsoDate.fromString("2026-06-01"));
    expect(found).toBeUndefined();
  });
});
