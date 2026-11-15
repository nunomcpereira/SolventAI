import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["SOLVENT_DB_PATH"] = ":memory:";
});
vi.mock("server-only", () => ({}));
vi.mock("./seed.js", () => ({ ensureSeeded: async () => {} }));

import { getDb } from "./db.js";
import { importStatement, getProposals, applyProposals, dismissProposal, restoreProposal, BankImportError, deleteImport } from "./bankImportService.js";
import { createSqliteAccountRepository, createSqliteRecurringTransferRepository, createSqliteExpenseRepository } from "../db/repositories/index.js";
import { parseAccount } from "../../domain/accounts/account.js";

const fixture = () => new Uint8Array(readFileSync(join(process.cwd(), "fixtures/bank/cgd-sample.csv")));

async function reset() {
  const db = await getDb();
  for (const table of ["bank_transactions", "bank_imports", "import_decisions", "accounts", "expenses", "incomes", "recurring_transfers", "entity_history"]) {
    db.exec(`DELETE FROM ${table}`);
  }
  const accounts = createSqliteAccountRepository(db);
  const base = { currency: "EUR", minimumReserve: { minorUnits: "0", currency: "EUR" }, active: true };
  await accounts.save(parseAccount({ ...base, id: "cgd", name: "CGD", type: "checking", initialBalance: { minorUnits: "100", currency: "EUR" }, isDefault: true }));
  await accounts.save(parseAccount({ ...base, id: "sav", name: "Poupança", type: "savings", initialBalance: { minorUnits: "0", currency: "EUR" }, isDefault: false }));
}

describe("bankImportService", () => {
  beforeEach(reset);

  it("imports a statement into the default account and sets its balance from the closing balance", async () => {
    const result = await importStatement({ fileName: "m.csv", bytes: fixture(), updateBalance: true });
    expect(result).toMatchObject({ accountId: "cgd", rowCount: 7, newRowCount: 7, balanceUpdated: true, periodEnd: "2026-03-14" });
    const account = await createSqliteAccountRepository(await getDb()).findById("cgd");
    expect(account?.initialBalance.toDecimalString()).toBe("3404.90");
  });

  it("re-importing the same file adds nothing and goes to the linked account", async () => {
    await importStatement({ fileName: "m.csv", bytes: fixture(), accountId: "cgd", updateBalance: false });
    const again = await importStatement({ fileName: "m.csv", bytes: fixture(), updateBalance: false });
    expect(again).toMatchObject({ accountId: "cgd", newRowCount: 0 });
  });

  it("leaves the balance alone when asked to", async () => {
    await importStatement({ fileName: "m.csv", bytes: fixture(), updateBalance: false });
    const account = await createSqliteAccountRepository(await getDb()).findById("cgd");
    expect(account?.initialBalance.toDecimalString()).toBe("1.00");
  });

  it("rejects files it can't read", async () => {
    await expect(importStatement({ fileName: "x.csv", bytes: new TextEncoder().encode("a;b\n1;2"), updateBalance: true })).rejects.toBeInstanceOf(BankImportError);
  });

  it("proposes, applies and remembers decisions", async () => {
    const { importId } = await importStatement({ fileName: "m.csv", bytes: fixture(), updateBalance: false });
    const view = await getProposals("cgd");
    expect(view.transactionCount).toBe(7);
    // Only 2 months of history: nothing is periodic yet, so there's nothing to propose.
    expect(view.proposals.filter((p) => p.source === "recurring")).toEqual([]);

    const applied = await applyProposals("cgd", [
      { key: "r:d:POUPPROGRAMADA", kind: "transfer", amount: "100", frequency: "monthly", category: "transfer", startDate: "2026-03-09", toAccountId: "sav" },
      { key: "r:d:Telecom", kind: "expense", amount: "39,99", frequency: "monthly", category: "utilities", startDate: "2026-02-05" },
    ]);
    expect(applied).toBe(2);
    const db = await getDb();
    const [transfer] = await createSqliteRecurringTransferRepository(db).list();
    expect(transfer).toMatchObject({ fromAccountId: "cgd", toAccountId: "sav" });
    const [expense] = await createSqliteExpenseRepository(db).list();
    expect(expense?.amount.toDecimalString()).toBe("39.99");

    await dismissProposal("cgd", "v:other");
    expect((await getProposals("cgd")).proposals.some((p) => p.key === "v:other")).toBe(false);
    await restoreProposal("cgd", "v:other");

    await deleteImport(importId);
    expect((await getProposals("cgd")).transactionCount).toBe(0);
  });
});
