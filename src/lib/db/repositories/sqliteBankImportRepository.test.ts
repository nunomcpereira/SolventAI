import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteBankImportRepository, type BankTransactionRecord } from "./sqliteBankImportRepository.js";

const tx = (id: string, importId: string): BankTransactionRecord => ({
  id,
  accountId: "acc",
  importId,
  bookingDate: "2026-01-0" + id.slice(-1),
  valueDate: "2026-01-0" + id.slice(-1),
  description: "NOS",
  amountMinorUnits: "-5197",
  currency: "EUR",
  balanceAfterMinorUnits: "100000",
});

const record = (id: string) => ({
  id,
  accountId: "acc",
  bank: "cgd",
  fileName: "m.csv",
  importedAt: `2026-01-1${id.slice(-1)}T00:00:00.000Z`,
  externalAccountRef: "0001",
  currency: "EUR",
  rowCount: 2,
  balanceCheckOk: true,
});

describe("SqliteBankImportRepository", () => {
  it("skips movements already imported and reports only new ones", () => {
    const repo = createSqliteBankImportRepository(openDatabase(":memory:"));
    expect(repo.saveImport(record("i1"), [tx("t1", "i1"), tx("t2", "i1")])).toBe(2);
    expect(repo.saveImport(record("i2"), [tx("t2", "i2"), tx("t3", "i2")])).toBe(1);
    expect(repo.listTransactions("acc").map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(repo.findImport("i2")?.newRowCount).toBe(1);
    expect(repo.accountForExternalRef("0001")).toBe("acc");
  });

  it("deleting an import removes its movements", () => {
    const repo = createSqliteBankImportRepository(openDatabase(":memory:"));
    repo.saveImport(record("i1"), [tx("t1", "i1")]);
    repo.saveImport(record("i2"), [tx("t2", "i2")]);
    repo.deleteImport("i1");
    expect(repo.listTransactions("acc").map((t) => t.id)).toEqual(["t2"]);
    expect(repo.listImports().map((i) => i.id)).toEqual(["i2"]);
  });

  it("remembers and clears decisions", () => {
    const repo = createSqliteBankImportRepository(openDatabase(":memory:"));
    repo.setDecision("acc", "r:d:NOS", "dismissed", "2026-01-01T00:00:00Z");
    repo.setDecision("acc", "r:d:NOS", "accepted", "2026-01-02T00:00:00Z");
    expect(repo.listDecisions("acc").get("r:d:NOS")).toBe("accepted");
    repo.clearDecision("acc", "r:d:NOS");
    expect(repo.listDecisions("acc").size).toBe(0);
  });
});
