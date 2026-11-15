import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteRecurringTransferRepository } from "./sqliteRecurringTransferRepository.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { parseRecurringTransfer } from "../../../domain/transfers/recurringTransfer.js";

const transfer = parseRecurringTransfer({
  id: "t1",
  fromAccountId: "checking",
  toAccountId: "savings",
  amount: { minorUnits: "10000", currency: "EUR" },
  frequency: "monthly",
  startDate: "2026-11-09",
  description: "Poupança",
});

describe("SqliteRecurringTransferRepository", () => {
  it("round-trips a transfer and records history", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteRecurringTransferRepository(db);
    await repo.save(transfer);
    expect(await repo.findById("t1")).toEqual(transfer);
    expect(await repo.list()).toEqual([transfer]);
    const rows = await createSqliteEntityHistoryRepository(db).listByType("transfer");
    expect(rows.map((r) => r.changeType)).toEqual(["save"]);
  });

  it("delete removes the row and records its last state", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteRecurringTransferRepository(db);
    await repo.save(transfer);
    await repo.delete("t1");
    expect(await repo.findById("t1")).toBeUndefined();
    const rows = await createSqliteEntityHistoryRepository(db).listByType("transfer");
    expect(rows.map((r) => r.changeType)).toEqual(["save", "delete"]);
  });
});
