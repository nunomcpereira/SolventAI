import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { detectRecurring, type DetectionInput, type HistoryTransaction, type Proposal } from "./recurrence.js";

const eur = (v: string) => Money.fromDecimalString(v, "EUR");
let seq = 0;
const tx = (date: string, description: string, amount: string): HistoryTransaction => ({
  id: `t${++seq}`,
  date: IsoDate.fromString(date),
  description,
  amount: eur(amount),
});

/** Same day each month from `from` for `count` months. */
function monthly(from: string, count: number, description: string, amount: (i: number) => string): HistoryTransaction[] {
  const start = IsoDate.fromString(from);
  return Array.from({ length: count }, (_, i) => tx(start.addMonths(i).toString(), description, amount(i)));
}

function run(transactions: HistoryTransaction[], overrides: Partial<DetectionInput> = {}): Proposal[] {
  return detectRecurring({
    accountId: "checking",
    currency: "EUR",
    transactions,
    asOf: IsoDate.fromString("2026-11-14"),
    otherAccounts: [
      { id: "savings", name: "Poupança", type: "savings" },
      { id: "revolut", name: "Revolut", type: "other" },
    ],
    loanPayments: [],
    existingItems: [],
    existingTransfers: [],
    ...overrides,
  });
}

const find = (proposals: Proposal[], label: string, source?: string) =>
  proposals.find((p) => p.label.includes(label) && (source === undefined || p.source === source));

describe("detectRecurring — periodic series", () => {
  it("finds a fixed monthly bill, dated on its last occurrence", () => {
    const p = find(run(monthly("2025-11-02", 13, "NOS Comunicacoes", () => "-44.90")), "NOS")!;
    expect(p).toMatchObject({ kind: "expense", source: "recurring", frequency: "monthly", category: "utilities", confidence: "high", variableAmount: false, status: "new" });
    expect(p.amount.toDecimalString()).toBe("44.90");
    expect(p.startDate.toString()).toBe("2026-11-02");
    expect(p.occurrences).toHaveLength(13);
  });

  it("uses the latest price of a fixed bill after a price change", () => {
    const p = find(run(monthly("2025-11-02", 13, "NOS Comunicacoes", (i) => (i < 10 ? "-42.90" : "-46.90"))), "NOS")!;
    expect(p.amount.toDecimalString()).toBe("46.90");
  });

  it("averages a variable bill and flags it", () => {
    const amounts = ["-40", "-60", "-55", "-45", "-70", "-30", "-50"];
    const p = find(run(monthly("2026-04-08", 7, "EDP COMERCIAL", (i) => amounts[i]!)), "EDP")!;
    expect(p.variableAmount).toBe(true);
    expect(p.amount.toDecimalString()).toBe(((60 + 55 + 45 + 70 + 30 + 50) / 6).toFixed(2));
  });

  it("does not propose a series that stopped", () => {
    expect(find(run(monthly("2025-01-10", 8, "GOLD ENERGY", () => "-100")), "GOLD")).toBeUndefined();
  });

  it("marks a new supplier that replaced a stopped one", () => {
    const p = find(run([...monthly("2025-01-10", 8, "GOLD ENERGY", () => "-100"), ...monthly("2025-09-12", 15, "EDP COMERCIAL", () => "-60")]), "EDP")!;
    expect(p.replaces).toBe("GOLD ENERGY");
  });

  it("ignores frequent merchants (several times a month)", () => {
    const groceries = Array.from({ length: 60 }, (_, i) => tx(IsoDate.fromString("2026-01-01").addDays(i * 5).toString(), "PINGO DOCE", "-30"));
    expect(run(groceries).filter((p) => p.source !== "average")).toEqual([]);
  });

  it("splits a salary's recurring yearly bonus and ignores tiny reimbursements", () => {
    const salary = monthly("2024-11-25", 24, "TRF EMPRESA EXEMPLO", (i) => ([5, 17].includes(i) ? "13000.00" : "4900.00"));
    const noise = [tx("2025-12-11", "TRF EMPRESA EXEMPLO", "9.38"), tx("2026-07-02", "TRF EMPRESA EXEMPLO", "0.01")];
    const proposals = run([...salary, ...noise]);
    const base = find(proposals, "EMPRESA", "recurring")!;
    expect(base).toMatchObject({ kind: "income", category: "salary", frequency: "monthly" });
    expect(base.amount.toDecimalString()).toBe("4900.00");
    const bonus = find(proposals, "EMPRESA", "extra")!;
    expect(bonus).toMatchObject({ kind: "income", category: "bonus", frequency: "annual" });
    expect(bonus.amount.toDecimalString()).toBe("8100.00");
    expect(bonus.startDate.toString()).toBe("2026-04-25");
  });
});

describe("detectRecurring — transfers, loans and existing items", () => {
  it("turns a standing order into a transfer to the savings account", () => {
    const p = find(run(monthly("2026-01-09", 11, "TRF POUP PROGRAMADA", () => "-100")), "POUP")!;
    expect(p).toMatchObject({ kind: "transfer", toAccountId: "savings", frequency: "monthly" });
  });

  it("matches a loan instalment instead of proposing it", () => {
    const p = find(
      run(monthly("2025-01-05", 22, "COBRANCA PRESTACAO", () => "-650.00"), {
        loanPayments: [{ loanId: "loan-1", name: "Mortgage", amount: eur("650.00") }],
      }),
      "PRESTACAO",
    )!;
    expect(p).toMatchObject({ status: "covered_by_loan", matchId: "loan-1" });
  });

  it("recognises items that already exist, and offers to update changed amounts", () => {
    const history = [...monthly("2025-11-02", 13, "NOS Comunicacoes", () => "-44.90"), ...monthly("2025-11-25", 12, "TRF EMPRESA", () => "3210.00")];
    const proposals = run(history, {
      existingItems: [
        { id: "e1", kind: "expense", category: "utilities", amount: eur("44.90"), frequency: "monthly" },
        { id: "i1", kind: "income", category: "salary", amount: eur("3300"), frequency: "monthly" },
      ],
    });
    expect(find(proposals, "NOS")).toMatchObject({ status: "exists", matchId: "e1" });
    expect(find(proposals, "EMPRESA")).toMatchObject({ status: "update", matchId: "i1" });
  });

  it("averages irregular top-ups to a known own account as a monthly transfer", () => {
    const topUps = ["2026-01-03", "2026-02-20", "2026-04-11", "2026-06-02", "2026-07-30", "2026-09-15"].map((d) => tx(d, "REVOLUT**8841*", "-120"));
    const p = run(topUps).find((x) => x.key === "t:revolut")!;
    expect(p).toMatchObject({ kind: "transfer", source: "average", toAccountId: "revolut" });
    expect(p.amount.isPositive()).toBe(true);
  });
});

describe("detectRecurring — annual and averages", () => {
  it("pairs a yearly charge about a year apart with a similar amount", () => {
    const p = find(run([tx("2025-07-07", "FIDELIDADE COMPANHI", "-210.00"), tx("2026-07-06", "FIDELIDADE COMPANHI", "-218.40")]), "FIDELIDADE")!;
    expect(p).toMatchObject({ source: "annual", frequency: "annual", category: "insurance" });
    expect(p.amount.toDecimalString()).toBe("218.40");
  });

  it("does not pair frequent counterparties by chance", () => {
    const mbway = Array.from({ length: 40 }, (_, i) => tx(IsoDate.fromString("2024-12-01").addDays(i * 17).toString(), "Trf Mbway 915XXX003", "-50"));
    expect(run(mbway).filter((p) => p.source === "annual")).toEqual([]);
  });

  it("averages the rest per category over full months only (trimmed)", () => {
    const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
    // Three shops a month (too frequent to be a bill) plus one big one-off in the first month.
    const shopping = months.flatMap((m) => [tx(`${m}-03`, "CONTINENTE", "-30"), tx(`${m}-12`, "CONTINENTE", "-30"), tx(`${m}-24`, "CONTINENTE", "-40")]);
    const oneOff = tx("2025-11-17", "LIDL", "-450");
    const partialMonth = tx("2026-11-10", "CONTINENTE", "-999");
    const food = run([...shopping, oneOff, partialMonth], { historyStart: IsoDate.fromString("2025-11-01") }).find((p) => p.key === "v:food")!;
    expect(food.monthsCovered).toBe(12);
    expect(food.amount.toDecimalString()).toBe("100.00"); // the 550 month is trimmed away
    expect(food.startDate.toString()).toBe("2026-11-15");
  });

  it("is deterministic", () => {
    const history = [...monthly("2025-11-02", 13, "NOS", () => "-44.90"), tx("2026-01-05", "CONTINENTE", "-80")];
    expect(JSON.stringify(run(history))).toBe(JSON.stringify(run([...history].reverse())));
  });
});
