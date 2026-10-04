import { describe, expect, it } from "vitest";
import { parseIncome, serializeIncome } from "./income.js";
import { DomainValidationError } from "../shared/errors.js";

function validRaw() {
  return {
    id: "inc-1",
    accountId: "acc-1",
    amount: { minorUnits: "350000", currency: "EUR" },
    frequency: "monthly",
    startDate: "2026-01-01",
    category: "salary",
  };
}

describe("parseIncome", () => {
  it("parses valid recurring income", () => {
    const income = parseIncome(validRaw());
    expect(income.amount.toDecimalString()).toBe("3500.00");
    expect(income.category).toBe("salary");
    expect(income.endDate).toBeUndefined();
  });

  it("parses optional endDate and inflationRule", () => {
    const income = parseIncome({
      ...validRaw(),
      endDate: "2030-01-01",
      inflationRule: { type: "annual", rate: "0.02" },
    });
    expect(income.endDate?.toString()).toBe("2030-01-01");
    expect(income.inflationRule?.rate.toString()).toBe("0.02");
  });

  it("round-trips through serializeIncome", () => {
    const income = parseIncome({ ...validRaw(), endDate: "2030-01-01" });
    expect(parseIncome(serializeIncome(income))).toEqual(income);
  });

  it("rejects non-positive amount", () => {
    expect(() => parseIncome({ ...validRaw(), amount: { minorUnits: "0", currency: "EUR" } })).toThrow(
      DomainValidationError,
    );
  });

  it("rejects endDate before startDate", () => {
    expect(() => parseIncome({ ...validRaw(), endDate: "2025-01-01" })).toThrow(DomainValidationError);
  });

  it("accepts custom categories beyond the built-in list", () => {
    const income = parseIncome({ ...validRaw(), category: "lottery" });
    expect(income.category).toBe("lottery");
  });

  it("rejects an empty category", () => {
    expect(() => parseIncome({ ...validRaw(), category: "" })).toThrow(DomainValidationError);
  });
});
