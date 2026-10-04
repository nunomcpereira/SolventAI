import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";

describe("SqliteEntityHistoryRepository", () => {
  it("round-trips a recorded entry", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteEntityHistoryRepository(db);
    repo.record({ entityType: "account", entityId: "acc-1", changeType: "save", snapshot: { name: "Main" } });

    const rows = await repo.listByType("account");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: "account",
      entityId: "acc-1",
      changeType: "save",
      snapshot: { name: "Main" },
    });
    expect(typeof rows[0]!.recordedAt).toBe("string");
  });

  it("listByType only returns rows for the requested type, in recorded order", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteEntityHistoryRepository(db);
    repo.record({ entityType: "account", entityId: "acc-1", changeType: "save", snapshot: { v: 1 } });
    repo.record({ entityType: "loan", entityId: "loan-1", changeType: "save", snapshot: { v: 1 } });
    repo.record({ entityType: "account", entityId: "acc-1", changeType: "save", snapshot: { v: 2 } });

    const accountRows = await repo.listByType("account");
    expect(accountRows.map((r) => (r.snapshot as { v: number }).v)).toEqual([1, 2]);

    const loanRows = await repo.listByType("loan");
    expect(loanRows).toHaveLength(1);
  });

  it("records a delete entry with the entity's last known snapshot", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteEntityHistoryRepository(db);
    repo.record({ entityType: "income", entityId: "inc-1", changeType: "save", snapshot: { amount: 100 } });
    repo.record({ entityType: "income", entityId: "inc-1", changeType: "delete", snapshot: { amount: 100 } });

    const rows = await repo.listByType("income");
    expect(rows.map((r) => r.changeType)).toEqual(["save", "delete"]);
  });
});
