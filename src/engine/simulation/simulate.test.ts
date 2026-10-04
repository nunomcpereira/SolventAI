import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money, sumMoney } from "../money/money.js";
import { runSimulation, type SimulationInput } from "./simulate.js";
import { type SimulationEvent } from "./events.js";

const d = (s: string) => IsoDate.fromString(s);
const m = (s: string) => Money.fromDecimalString(s, "EUR");

function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    currency: "EUR",
    accounts: [
      { accountId: "checking", initialBalance: m("5000.00"), minimumReserve: m("1000.00") },
      { accountId: "savings", initialBalance: m("20000.00"), minimumReserve: m("5000.00") },
    ],
    incomeItems: [],
    expenseItems: [],
    events: [],
    horizonStart: d("2026-01-01"),
    periodFrequency: "monthly",
    numberOfPeriods: 6,
    ...overrides,
  };
}

function balanceOf(snapshot: ReturnType<typeof runSimulation>[number], accountId: string): Money {
  return snapshot.accounts.find((a) => a.accountId === accountId)!.balance;
}

describe("runSimulation — basic income/expense", () => {
  it("accrues monthly income into the target account", () => {
    const snapshots = runSimulation(
      baseInput({
        incomeItems: [
          { id: "salary", accountId: "checking", amount: m("3000.00"), frequency: "monthly", startDate: d("2026-01-01") },
        ],
      }),
    );
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("8000.00");
    expect(balanceOf(snapshots[5]!, "checking").toDecimalString()).toBe("23000.00");
  });

  it("deducts monthly expenses from the target account", () => {
    const snapshots = runSimulation(
      baseInput({
        expenseItems: [
          { id: "rent", accountId: "checking", amount: m("1000.00"), frequency: "monthly", startDate: d("2026-01-01") },
        ],
      }),
    );
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("4000.00");
  });

  it("produces exactly numberOfPeriods snapshots with monotonic period numbers", () => {
    const snapshots = runSimulation(baseInput());
    expect(snapshots).toHaveLength(6);
    expect(snapshots.map((s) => s.period)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("runSimulation — events", () => {
  it("balance_override resets the account's opening cash for that period", () => {
    const events: SimulationEvent[] = [
      { id: "e1", date: d("2026-03-01"), payload: { type: "balance_override", accountId: "checking", newBalance: m("99999.00") } },
    ];
    const snapshots = runSimulation(baseInput({ events }));
    expect(balanceOf(snapshots[1]!, "checking").toDecimalString()).toBe("5000.00"); // unaffected period 2
    expect(balanceOf(snapshots[2]!, "checking").toDecimalString()).toBe("99999.00"); // period 3 overridden
  });

  it("account_transfer conserves total liquidity", () => {
    const events: SimulationEvent[] = [
      {
        id: "e1",
        date: d("2026-02-01"),
        payload: { type: "account_transfer", fromAccountId: "savings", toAccountId: "checking", amount: m("2000.00"), creditedAmount: m("2000.00") },
      },
    ];
    const snapshots = runSimulation(baseInput({ events }));
    const period2 = snapshots[1]!;
    const total = sumMoney("EUR", period2.accounts.map((a) => a.balance));
    expect(total.toDecimalString()).toBe("25000.00"); // 5000 + 20000, unchanged in aggregate
    expect(balanceOf(period2, "checking").toDecimalString()).toBe("7000.00");
    expect(balanceOf(period2, "savings").toDecimalString()).toBe("18000.00");
  });

  it("one_time_income and one_time_expense apply exactly once, in the correct period", () => {
    const events: SimulationEvent[] = [
      { id: "e1", date: d("2026-02-15"), payload: { type: "one_time_income", accountId: "checking", amount: m("500.00") } },
      { id: "e2", date: d("2026-04-15"), payload: { type: "one_time_expense", accountId: "checking", amount: m("200.00") } },
    ];
    const snapshots = runSimulation(baseInput({ events }));
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("5000.00");
    expect(balanceOf(snapshots[1]!, "checking").toDecimalString()).toBe("5500.00");
    expect(balanceOf(snapshots[2]!, "checking").toDecimalString()).toBe("5500.00");
    expect(balanceOf(snapshots[3]!, "checking").toDecimalString()).toBe("5300.00");
  });

  it("income_change overrides the amount from its period forward", () => {
    const events: SimulationEvent[] = [
      { id: "e1", date: d("2026-03-01"), payload: { type: "income_change", incomeId: "salary", newAmount: m("4000.00") } },
    ];
    const snapshots = runSimulation(
      baseInput({
        incomeItems: [
          { id: "salary", accountId: "checking", amount: m("3000.00"), frequency: "monthly", startDate: d("2026-01-01") },
        ],
        events,
      }),
    );
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("8000.00"); // 5000 + 3000
    expect(balanceOf(snapshots[1]!, "checking").toDecimalString()).toBe("11000.00"); // + 3000
    expect(balanceOf(snapshots[2]!, "checking").toDecimalString()).toBe("15000.00"); // + 4000 (changed)
  });

  it("income_change with an endDate reverts to the configured amount after it", () => {
    const events: SimulationEvent[] = [
      {
        id: "e1",
        date: d("2026-02-01"),
        payload: { type: "income_change", incomeId: "salary", newAmount: m("0.00"), endDate: d("2026-03-31") },
      },
    ];
    const snapshots = runSimulation(
      baseInput({
        incomeItems: [
          { id: "salary", accountId: "checking", amount: m("3000.00"), frequency: "monthly", startDate: d("2026-01-01") },
        ],
        events,
      }),
    );
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("8000.00"); // + 3000
    expect(balanceOf(snapshots[1]!, "checking").toDecimalString()).toBe("8000.00"); // + 0 (Feb)
    expect(balanceOf(snapshots[2]!, "checking").toDecimalString()).toBe("8000.00"); // + 0 (Mar, end date)
    expect(balanceOf(snapshots[3]!, "checking").toDecimalString()).toBe("11000.00"); // + 3000 (reverted)
  });

  it("prepayment reduces the source account by the event amount", () => {
    const events: SimulationEvent[] = [
      { id: "e1", date: d("2026-02-01"), payload: { type: "prepayment", loanId: "loan-1", sourceAccountId: "savings", amount: m("5000.00"), strategy: "reduce_payment" } },
    ];
    const snapshots = runSimulation(baseInput({ events }));
    expect(balanceOf(snapshots[1]!, "savings").toDecimalString()).toBe("15000.00");
  });

  it("debt payments reduce the paying account each period they are due", () => {
    const snapshots = runSimulation(
      baseInput({
        debtPayments: [
          { accountId: "checking", period: 1, amount: m("500.00") },
          { accountId: "checking", period: 2, amount: m("500.00") },
        ],
      }),
    );
    expect(balanceOf(snapshots[0]!, "checking").toDecimalString()).toBe("4500.00");
    expect(balanceOf(snapshots[1]!, "checking").toDecimalString()).toBe("4000.00");
    expect(balanceOf(snapshots[2]!, "checking").toDecimalString()).toBe("4000.00");
  });

  it("records applied events per period in canonical order", () => {
    const events: SimulationEvent[] = [
      { id: "e2", date: d("2026-01-01"), payload: { type: "one_time_expense", accountId: "checking", amount: m("1.00") } },
      { id: "e1", date: d("2026-01-01"), payload: { type: "balance_override", accountId: "checking", newBalance: m("1.00") } },
    ];
    const snapshots = runSimulation(baseInput({ events }));
    expect(snapshots[0]!.appliedEvents.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("rejects an event referencing an unknown account", () => {
    const events: SimulationEvent[] = [
      { id: "e1", date: d("2026-01-01"), payload: { type: "one_time_income", accountId: "nope", amount: m("1.00") } },
    ];
    expect(() => runSimulation(baseInput({ events }))).toThrow(/unknown account/);
  });

  it("rejects non-positive numberOfPeriods", () => {
    expect(() => runSimulation(baseInput({ numberOfPeriods: 0 }))).toThrow();
  });
});
