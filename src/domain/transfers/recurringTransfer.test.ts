import { describe, expect, it } from "vitest";
import { parseRecurringTransfer, serializeRecurringTransfer } from "./recurringTransfer.js";
import { DomainValidationError } from "../shared/index.js";

const raw = {
  id: "t1",
  fromAccountId: "checking",
  toAccountId: "savings",
  amount: { minorUnits: "10000", currency: "EUR" },
  frequency: "monthly",
  startDate: "2026-11-09",
};

describe("parseRecurringTransfer", () => {
  it("round-trips through serialize", () => {
    const parsed = parseRecurringTransfer({ ...raw, description: "Poupança programada" });
    expect(serializeRecurringTransfer(parsed)).toEqual({ ...raw, description: "Poupança programada" });
  });

  it("rejects a transfer to the same account", () => {
    expect(() => parseRecurringTransfer({ ...raw, toAccountId: "checking" })).toThrow(DomainValidationError);
  });

  it("rejects a non-positive amount", () => {
    expect(() => parseRecurringTransfer({ ...raw, amount: { minorUnits: "0", currency: "EUR" } })).toThrow(DomainValidationError);
  });

  it("rejects an end date before the start date", () => {
    expect(() => parseRecurringTransfer({ ...raw, endDate: "2026-01-01" })).toThrow(DomainValidationError);
  });
});
