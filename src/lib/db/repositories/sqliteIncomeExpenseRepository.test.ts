import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteIncomeRepository } from "./sqliteIncomeRepository.js";
import { createSqliteExpenseRepository } from "./sqliteExpenseRepository.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { parseIncome } from "../../../domain/income/income.js";
import { parseExpense } from "../../../domain/expenses/expense.js";

describe("SqliteIncomeRepository", () => {
  it("round-trips income including optional endDate and inflationRule", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteIncomeRepository(db);
    const income = parseIncome({
      id: "inc-1",
      accountId: "acc-1",
      amount: { minorUnits: "350000", currency: "EUR" },
      frequency: "monthly",
      startDate: "2026-01-01",
      endDate: "2030-01-01",
      category: "salary",
      inflationRule: { type: "annual", rate: "0.02" },
    });
    await repo.save(income);
    expect(await repo.findById("inc-1")).toEqual(income);
  });

  it("round-trips income without optional fields", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteIncomeRepository(db);
    const income = parseIncome({
      id: "inc-2",
      accountId: "acc-1",
      amount: { minorUnits: "10000", currency: "EUR" },
      frequency: "monthly",
      startDate: "2026-01-01",
      category: "freelance",
    });
    await repo.save(income);
    const found = await repo.findById("inc-2");
    expect(found).toEqual(income);
    expect(found?.endDate).toBeUndefined();
    expect(found?.inflationRule).toBeUndefined();
  });

  it("delete removes the income", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteIncomeRepository(db);
    await repo.save(
      parseIncome({
        id: "inc-1",
        accountId: "acc-1",
        amount: { minorUnits: "1000", currency: "EUR" },
        frequency: "monthly",
        startDate: "2026-01-01",
        category: "other",
      }),
    );
    await repo.delete("inc-1");
    expect(await repo.findById("inc-1")).toBeUndefined();
  });

  it("records an audit-history row on save and on delete", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteIncomeRepository(db);
    await repo.save(
      parseIncome({
        id: "inc-1",
        accountId: "acc-1",
        amount: { minorUnits: "1000", currency: "EUR" },
        frequency: "monthly",
        startDate: "2026-01-01",
        category: "other",
      }),
    );
    await repo.delete("inc-1");

    const history = await createSqliteEntityHistoryRepository(db).listByType("income");
    expect(history.map((h) => h.changeType)).toEqual(["save", "delete"]);
  });
});

describe("SqliteExpenseRepository", () => {
  it("round-trips expense including inflationRule", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteExpenseRepository(db);
    const expense = parseExpense({
      id: "exp-1",
      accountId: "acc-1",
      amount: { minorUnits: "120000", currency: "EUR" },
      frequency: "monthly",
      startDate: "2026-01-01",
      category: "housing",
      inflationRule: { type: "monthly_compounded", rate: "0.002" },
    });
    await repo.save(expense);
    expect(await repo.findById("exp-1")).toEqual(expense);
  });

  it("list returns all saved expenses ordered", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteExpenseRepository(db);
    await repo.save(
      parseExpense({
        id: "exp-1",
        accountId: "acc-1",
        amount: { minorUnits: "1000", currency: "EUR" },
        frequency: "monthly",
        startDate: "2026-02-01",
        category: "food",
      }),
    );
    await repo.save(
      parseExpense({
        id: "exp-2",
        accountId: "acc-1",
        amount: { minorUnits: "2000", currency: "EUR" },
        frequency: "monthly",
        startDate: "2026-01-01",
        category: "utilities",
      }),
    );
    const all = await repo.list();
    expect(all.map((e) => e.id)).toEqual(["exp-2", "exp-1"]);
  });
});
