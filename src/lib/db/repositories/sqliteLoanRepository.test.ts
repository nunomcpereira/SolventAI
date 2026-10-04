import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteLoanRepository } from "./sqliteLoanRepository.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { parseLoan } from "../../../domain/loans/loan.js";

function fixedRateLoan(id = "loan-1") {
  return parseLoan({
    id,
    name: "Home Mortgage",
    category: "mortgage",
    principal: { minorUnits: "20000000", currency: "EUR" },
    startDate: "2026-01-01",
    numberOfPeriods: 360,
    paymentFrequency: "monthly",
    amortizationType: "french",
    dayCountConvention: "actual/365",
    rate: { type: "fixed", annualRate: "0.035" },
    sourceAccountId: "acc-1",
    fees: [
      { id: "fee-1", description: "Origination fee", amount: { minorUnits: "50000", currency: "EUR" }, timing: "origination" },
    ],
    prepaymentPenalty: { type: "percentage", rate: "0.005", maximumPenalty: { minorUnits: "100000", currency: "EUR" } },
  });
}

function variableRateLoan(id = "loan-2") {
  return parseLoan({
    id,
    name: "Auto Loan",
    category: "auto",
    principal: { minorUnits: "3000000", currency: "EUR" },
    startDate: "2026-03-01",
    numberOfPeriods: 60,
    paymentFrequency: "monthly",
    amortizationType: "constant_amortization",
    dayCountConvention: "30/360",
    rate: {
      type: "variable",
      index: "EURIBOR_6M",
      currentIndexRate: "0.02",
      spread: "0.015",
      resetFrequency: "semiannual",
      rateCap: "0.09",
    },
    sourceAccountId: "acc-1",
    fees: [],
    prepaymentPenalty: { type: "none" },
  });
}

describe("SqliteLoanRepository", () => {
  it("saves and retrieves a fixed-rate loan with fees, exact round-trip", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    const loan = fixedRateLoan();
    await repo.save(loan);

    const found = await repo.findById("loan-1");
    expect(found).toEqual(loan);
    expect(found?.fees).toHaveLength(1);
    expect(found?.prepaymentPenalty.type).toBe("percentage");
  });

  it("saves and retrieves a variable-rate loan with no fees and no penalty", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    const loan = variableRateLoan();
    await repo.save(loan);

    const found = await repo.findById("loan-2");
    expect(found).toEqual(loan);
    expect(found?.rate.type).toBe("variable");
    expect(found?.fees).toHaveLength(0);
  });

  it("re-saving replaces fees rather than accumulating duplicates", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    await repo.save(fixedRateLoan());
    await repo.save(fixedRateLoan()); // same fee id, same content
    const found = await repo.findById("loan-1");
    expect(found?.fees).toHaveLength(1);
  });

  it("list returns all saved loans", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    await repo.save(fixedRateLoan());
    await repo.save(variableRateLoan());
    const all = await repo.list();
    expect(all.map((l) => l.id).sort()).toEqual(["loan-1", "loan-2"]);
  });

  it("delete removes the loan (fees cascade via FK)", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    await repo.save(fixedRateLoan());
    await repo.delete("loan-1");
    expect(await repo.findById("loan-1")).toBeUndefined();
    const remainingFees = db.prepare("SELECT * FROM loan_fees WHERE loan_id = ?").all("loan-1");
    expect(remainingFees).toHaveLength(0);
  });

  it("records an audit-history row on save and on delete, snapshotting fees on delete", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteLoanRepository(db);
    await repo.save(fixedRateLoan());
    await repo.delete("loan-1");

    const history = await createSqliteEntityHistoryRepository(db).listByType("loan");
    expect(history.map((h) => h.changeType)).toEqual(["save", "delete"]);
    expect((history[1]!.snapshot as { fees: unknown[] }).fees).toHaveLength(1);
  });
});
