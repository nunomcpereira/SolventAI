import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { applyLedgerEntries } from "./ledger.js";
import { buildTransferEntries, type TransferRequest } from "./transfer.js";

const d = (s: string) => IsoDate.fromString(s);
const m = (s: string, c = "EUR") => Money.fromDecimalString(s, c);

describe("buildTransferEntries", () => {
  it("builds a matched transfer_out/transfer_in pair for same-currency transfers", () => {
    const request: TransferRequest = {
      id: "t1",
      date: d("2026-01-01"),
      fromAccountId: "checking",
      toAccountId: "savings",
      amount: m("500.00"),
      creditedAmount: m("500.00"),
    };
    const { fromEntry, toEntry } = buildTransferEntries(request);
    expect(fromEntry.type).toBe("transfer_out");
    expect(toEntry.type).toBe("transfer_in");
    expect(fromEntry.amount.equals(toEntry.amount)).toBe(true);
  });

  it("rejects mismatched same-currency amount/creditedAmount (would create/destroy money)", () => {
    const request: TransferRequest = {
      id: "t1",
      date: d("2026-01-01"),
      fromAccountId: "checking",
      toAccountId: "savings",
      amount: m("500.00"),
      creditedAmount: m("400.00"),
    };
    expect(() => buildTransferEntries(request)).toThrow(/credit the exact debited amount/);
  });

  it("allows differing creditedAmount when currencies differ (explicit FX conversion)", () => {
    const request: TransferRequest = {
      id: "t1",
      date: d("2026-01-01"),
      fromAccountId: "eur-account",
      toAccountId: "usd-account",
      amount: m("100.00", "EUR"),
      creditedAmount: m("108.00", "USD"),
    };
    expect(() => buildTransferEntries(request)).not.toThrow();
  });

  it("rejects non-positive transfer amount", () => {
    const request: TransferRequest = {
      id: "t1",
      date: d("2026-01-01"),
      fromAccountId: "a",
      toAccountId: "b",
      amount: m("0.00"),
      creditedAmount: m("0.00"),
    };
    expect(() => buildTransferEntries(request)).toThrow(/must be positive/);
  });

  it("total liquidity is conserved across a same-currency transfer applied to both accounts", () => {
    const request: TransferRequest = {
      id: "t1",
      date: d("2026-01-01"),
      fromAccountId: "checking",
      toAccountId: "savings",
      amount: m("500.00"),
      creditedAmount: m("500.00"),
    };
    const { fromEntry, toEntry } = buildTransferEntries(request);

    const checkingBefore = m("1000.00");
    const savingsBefore = m("2000.00");
    const checkingAfter = applyLedgerEntries(checkingBefore, [fromEntry]).closingBalance;
    const savingsAfter = applyLedgerEntries(savingsBefore, [toEntry]).closingBalance;

    const totalBefore = checkingBefore.add(savingsBefore);
    const totalAfter = checkingAfter.add(savingsAfter);
    expect(totalAfter.equals(totalBefore)).toBe(true);
  });
});
