import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { orderEvents, type SimulationEvent } from "./events.js";

const d = (s: string) => IsoDate.fromString(s);
const m = (s: string) => Money.fromDecimalString(s, "EUR");

function event(id: string, date: string, type: string): SimulationEvent {
  const payloads: Record<string, SimulationEvent["payload"]> = {
    balance_override: { type: "balance_override", accountId: "a", newBalance: m("100.00") },
    rate_change: { type: "rate_change", loanId: "l", index: "SOFR", newAnnualValue: Decimal.fromString("0.05") },
    income_change: { type: "income_change", incomeId: "i", newAmount: m("100.00") },
    expense_change: { type: "expense_change", expenseId: "e", newAmount: m("100.00") },
    one_time_income: { type: "one_time_income", accountId: "a", amount: m("100.00") },
    account_transfer: { type: "account_transfer", fromAccountId: "a", toAccountId: "b", amount: m("100.00"), creditedAmount: m("100.00") },
    prepayment: { type: "prepayment", loanId: "l", sourceAccountId: "a", amount: m("100.00"), strategy: "reduce_payment" },
    one_time_expense: { type: "one_time_expense", accountId: "a", amount: m("100.00") },
  };
  return { id, date: d(date), payload: payloads[type]! };
}

describe("orderEvents", () => {
  it("sorts by date first", () => {
    const events = [event("2", "2026-03-01", "one_time_expense"), event("1", "2026-01-01", "one_time_income")];
    expect(orderEvents(events).map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("applies documented type priority within the same date", () => {
    const events = [
      event("a", "2026-01-01", "one_time_expense"),
      event("b", "2026-01-01", "prepayment"),
      event("c", "2026-01-01", "account_transfer"),
      event("d", "2026-01-01", "one_time_income"),
      event("e", "2026-01-01", "expense_change"),
      event("f", "2026-01-01", "income_change"),
      event("g", "2026-01-01", "rate_change"),
      event("h", "2026-01-01", "balance_override"),
    ];
    const ordered = orderEvents(events).map((e) => e.payload.type);
    expect(ordered).toEqual([
      "balance_override",
      "rate_change",
      "income_change",
      "expense_change",
      "one_time_income",
      "account_transfer",
      "prepayment",
      "one_time_expense",
    ]);
  });

  it("breaks ties within same date+type by event id", () => {
    const events = [event("z", "2026-01-01", "one_time_income"), event("a", "2026-01-01", "one_time_income")];
    expect(orderEvents(events).map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("is a pure function (does not mutate input array)", () => {
    const events = [event("2", "2026-03-01", "one_time_expense"), event("1", "2026-01-01", "one_time_income")];
    const original = [...events];
    orderEvents(events);
    expect(events).toEqual(original);
  });
});
