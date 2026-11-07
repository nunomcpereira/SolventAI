import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en.json" with { type: "json" };
import { entityName, fieldLabel, formatAuditValue, formatRate } from "./formatAudit.js";
import { type AuditEvent } from "./auditLog.js";

const names = { accounts: new Map([["acc-1", "Caixa Geral Depositos"]]), loans: new Map([["loan-1", "CGD mortgage"]]) };
const fmt = (path: string, value: unknown) => formatAuditValue(path, value, "en", en, names);

describe("fieldLabel", () => {
  it("labels nested and keyed paths", () => {
    expect(fieldLabel("rate.currentIndexRate", en)).toBe("Index rate (e.g. Euribor)");
    expect(fieldLabel("initialBalance", en)).toBe("Balance");
    expect(fieldLabel("events[ev-1]", en)).toBe("Event");
    expect(fieldLabel("accountTypeLabels.checking", en)).toBe("Account type label · checking");
  });

  it("falls back to a readable version of unknown paths", () => {
    expect(fieldLabel("somethingNew", en)).toBe("Something New");
  });
});

describe("formatAuditValue", () => {
  it("formats money, rates, booleans, dates and ids", () => {
    expect(fmt("initialBalance", { minorUnits: "7000000", currency: "EUR" })).toBe("€70,000.00");
    expect(fmt("rate.currentIndexRate", "0.03016")).toBe("3.016%");
    expect(fmt("rate.spread", "0.007")).toBe("0.7%");
    expect(fmt("active", true)).toBe("Yes");
    expect(fmt("startDate", "2024-07-07")).toBe("Jul 07, 2024");
    expect(fmt("sourceAccountId", "acc-1")).toBe("Caixa Geral Depositos");
    expect(fmt("endDate", undefined)).toBe("—");
  });

  it("uses existing translations for enum values", () => {
    expect(fmt("roundingMode", "half-even")).toBe("Half-even (banker's rounding)");
    expect(fmt("rate.type", "mixed")).toBe("Mixed (fixed then variable)");
    expect(fmt("frequency", "monthly")).toBe("Monthly");
  });

  it("summarises a scenario event", () => {
    const event = {
      id: "ev-1",
      date: "2027-01-01",
      payload: { type: "prepayment", loanId: "loan-1", sourceAccountId: "acc-1", amount: { minorUnits: "500000", currency: "EUR" }, strategy: "reduce_payment" },
    };
    expect(fmt("events[ev-1]", event)).toBe("Jan 01, 2027 · Loan prepayment (amortization) · €5,000.00 · CGD mortgage");
  });
});

describe("formatRate", () => {
  it("avoids float noise", () => {
    expect(formatRate("0.02683")).toBe("2.683%");
    expect(formatRate("0.1")).toBe("10%");
  });
});

describe("entityName", () => {
  const ev = (entityType: AuditEvent["entityType"], snapshot: unknown): AuditEvent => ({
    id: "h", recordedAt: "2026-11-07T10:00:00Z", entityType, entityId: "x", action: "updated", snapshot, changes: [],
  });

  it("uses the entity's name, or category and account for income/expenses", () => {
    expect(entityName(ev("loan", { name: "CGD mortgage" }), en, names)).toBe("CGD mortgage");
    expect(entityName(ev("expense", { category: "housing", accountId: "acc-1" }), en, names)).toBe("Housing (Caixa Geral Depositos)");
    expect(entityName(ev("settings", {}), en, names)).toBe("Settings");
  });
});
