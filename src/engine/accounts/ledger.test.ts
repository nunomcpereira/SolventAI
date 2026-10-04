import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { applyLedgerEntries, assertConserves, findReserveBreaches, type LedgerEntry } from "./ledger.js";

const d = (s: string) => IsoDate.fromString(s);
const m = (s: string) => Money.fromDecimalString(s, "EUR");

describe("applyLedgerEntries", () => {
  it("applies deposits and withdrawals sequentially", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-05"), type: "deposit", amount: m("1000.00") },
      { id: "2", date: d("2026-01-10"), type: "withdrawal", amount: m("250.00") },
      { id: "3", date: d("2026-01-15"), type: "deposit", amount: m("50.00") },
    ];
    const result = applyLedgerEntries(m("500.00"), entries);
    expect(result.closingBalance.toDecimalString()).toBe("1300.00");
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]!.closingBalance.toDecimalString()).toBe("1500.00");
    expect(result.steps[1]!.closingBalance.toDecimalString()).toBe("1250.00");
    expect(result.steps[2]!.closingBalance.toDecimalString()).toBe("1300.00");
  });

  it("transfer_in/transfer_out behave like deposit/withdrawal for balance purposes", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-01"), type: "transfer_in", amount: m("100.00") },
      { id: "2", date: d("2026-01-02"), type: "transfer_out", amount: m("40.00") },
    ];
    const result = applyLedgerEntries(m("0.00"), entries);
    expect(result.closingBalance.toDecimalString()).toBe("60.00");
  });

  it("balance_override sets absolute balance regardless of prior state", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-01"), type: "deposit", amount: m("100.00") },
      { id: "2", date: d("2026-01-02"), type: "balance_override", amount: m("9999.00") },
    ];
    const result = applyLedgerEntries(m("0.00"), entries);
    expect(result.closingBalance.toDecimalString()).toBe("9999.00");
  });

  it("rejects negative amounts for deposit/withdrawal/transfer entries", () => {
    const entries: LedgerEntry[] = [{ id: "1", date: d("2026-01-01"), type: "deposit", amount: m("-1.00") }];
    expect(() => applyLedgerEntries(m("0.00"), entries)).toThrow(/non-negative/);
  });

  it("rejects currency mismatch between entry and account", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-01"), type: "deposit", amount: Money.fromDecimalString("10.00", "USD") },
    ];
    expect(() => applyLedgerEntries(m("0.00"), entries)).toThrow(/currency/);
  });

  it("withdrawal can drive balance negative (overdraft is a downstream liquidity concern, not a ledger error)", () => {
    const entries: LedgerEntry[] = [{ id: "1", date: d("2026-01-01"), type: "withdrawal", amount: m("100.00") }];
    const result = applyLedgerEntries(m("50.00"), entries);
    expect(result.closingBalance.toDecimalString()).toBe("-50.00");
  });
});

describe("assertConserves", () => {
  it("passes for a chain of deposits/withdrawals matching opening+inflows-outflows", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-01"), type: "deposit", amount: m("1000.00") },
      { id: "2", date: d("2026-01-02"), type: "withdrawal", amount: m("300.00") },
    ];
    const result = applyLedgerEntries(m("100.00"), entries);
    expect(() => assertConserves(result)).not.toThrow();
  });

  it("throws when a balance_override is present", () => {
    const entries: LedgerEntry[] = [{ id: "1", date: d("2026-01-01"), type: "balance_override", amount: m("500.00") }];
    const result = applyLedgerEntries(m("0.00"), entries);
    expect(() => assertConserves(result)).toThrow(/balance_override/);
  });
});

describe("findReserveBreaches", () => {
  it("flags steps where balance falls below minimumReserve", () => {
    const entries: LedgerEntry[] = [
      { id: "1", date: d("2026-01-01"), type: "withdrawal", amount: m("600.00") },
      { id: "2", date: d("2026-01-02"), type: "deposit", amount: m("700.00") },
      { id: "3", date: d("2026-01-03"), type: "withdrawal", amount: m("900.00") },
    ];
    const result = applyLedgerEntries(m("1000.00"), entries);
    const breaches = findReserveBreaches(result, { minimumReserve: m("500.00") });
    expect(breaches).toHaveLength(2);
    expect(breaches[0]!.entry.id).toBe("1");
    expect(breaches[1]!.entry.id).toBe("3");
  });
});
