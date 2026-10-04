import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteAccountRepository } from "./sqliteAccountRepository.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { parseAccount } from "../../../domain/accounts/account.js";

function sampleAccount(id = "acc-1") {
  return parseAccount({
    id,
    name: "Main Checking",
    type: "checking",
    currency: "EUR",
    initialBalance: { minorUnits: "150000", currency: "EUR" },
    minimumReserve: { minorUnits: "50000", currency: "EUR" },
    active: true,
  });
}

describe("SqliteAccountRepository", () => {
  it("saves and retrieves an account with exact Money round-trip", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    const account = sampleAccount();
    await repo.save(account);

    const found = await repo.findById("acc-1");
    expect(found).toEqual(account);
    expect(found?.initialBalance.toDecimalString()).toBe("1500.00");
  });

  it("returns undefined for missing id", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    expect(await repo.findById("nope")).toBeUndefined();
  });

  it("list returns all saved accounts", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(sampleAccount("acc-1"));
    await repo.save(sampleAccount("acc-2"));
    const all = await repo.list();
    expect(all.map((a) => a.id).sort()).toEqual(["acc-1", "acc-2"]);
  });

  it("save upserts (re-saving updates fields in place)", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(sampleAccount());
    const updated = parseAccount({
      id: "acc-1",
      name: "Renamed",
      type: "savings",
      currency: "EUR",
      initialBalance: { minorUnits: "0", currency: "EUR" },
      minimumReserve: { minorUnits: "0", currency: "EUR" },
      active: false,
    });
    await repo.save(updated);
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.name).toBe("Renamed");
    expect(all[0]!.active).toBe(false);
  });

  it("delete removes the account", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(sampleAccount());
    await repo.delete("acc-1");
    expect(await repo.findById("acc-1")).toBeUndefined();
  });

  it("records an audit-history row on save and on delete", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(sampleAccount());
    await repo.delete("acc-1");

    const history = await createSqliteEntityHistoryRepository(db).listByType("account");
    expect(history.map((h) => h.changeType)).toEqual(["save", "delete"]);
    expect(history.every((h) => h.entityId === "acc-1")).toBe(true);
  });
});
