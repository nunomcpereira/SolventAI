import { describe, expect, it } from "vitest";
import { parseExpense, serializeExpense } from "./expense.js";
import { DomainValidationError } from "../shared/errors.js";

function validRaw() {
  return {
    id: "exp-1",
    accountId: "acc-1",
    amount: { minorUnits: "120000", currency: "EUR" },
    frequency: "monthly",
    startDate: "2026-01-01",
    category: "housing",
  };
}

describe("parseExpense", () => {
  it("parses valid recurring expense", () => {
    const expense = parseExpense(validRaw());
    expect(expense.amount.toDecimalString()).toBe("1200.00");
    expect(expense.category).toBe("housing");
  });

  it("round-trips through serializeExpense", () => {
    const expense = parseExpense({ ...validRaw(), inflationRule: { type: "monthly_compounded", rate: "0.002" } });
    expect(parseExpense(serializeExpense(expense))).toEqual(expense);
  });

  it("rejects non-positive amount", () => {
    expect(() => parseExpense({ ...validRaw(), amount: { minorUnits: "-1", currency: "EUR" } })).toThrow(
      DomainValidationError,
    );
  });

  it("rejects endDate before startDate", () => {
    expect(() => parseExpense({ ...validRaw(), endDate: "2020-01-01" })).toThrow(DomainValidationError);
  });

  it("rejects unknown category", () => {
    expect(() => parseExpense({ ...validRaw(), category: "vacation" })).toThrow(DomainValidationError);
  });
});
