import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";
import { restoreSnapshot } from "./restoreSnapshot.js";
import { createSqliteAccountRepository } from "./repositories/sqliteAccountRepository.js";
import { createSqliteEntityHistoryRepository } from "./repositories/sqliteEntityHistoryRepository.js";
import { parseAccount, serializeAccount } from "../../domain/accounts/account.js";
import { buildAuditEvents, restorableSnapshot } from "../audit/auditLog.js";

const account = (id: string, balance: string, isDefault = false) =>
  parseAccount({
    id,
    name: id,
    type: "checking",
    currency: "EUR",
    initialBalance: { minorUnits: balance, currency: "EUR" },
    minimumReserve: { minorUnits: "0", currency: "EUR" },
    active: true,
    isDefault,
  });

describe("restoreSnapshot", () => {
  it("writes the previous version back and logs the restore as a new change", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(account("a1", "100"));
    await repo.save(account("a1", "999"));
    const history = createSqliteEntityHistoryRepository(db);
    const [update] = buildAuditEvents(await history.listAll());
    expect(update?.action).toBe("updated");

    await restoreSnapshot(db, "account", restorableSnapshot(update!));
    expect((await repo.findById("a1"))?.initialBalance.minorUnits.toString()).toBe("100");
    const [latest] = buildAuditEvents(await history.listAll());
    expect(latest?.changes).toEqual([{ path: "initialBalance", before: { minorUnits: "999", currency: "EUR" }, after: { minorUnits: "100", currency: "EUR" } }]);
    db.close();
  });

  it("recreates a deleted account without stealing the default flag", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteAccountRepository(db);
    await repo.save(account("old", "1", true));
    const snapshot = serializeAccount((await repo.findById("old"))!);
    await repo.delete("old");
    await repo.save(account("new", "2", true));

    await restoreSnapshot(db, "account", snapshot);
    expect((await repo.findById("old"))?.isDefault).toBe(false);
    expect((await repo.findById("new"))?.isDefault).toBe(true);
    db.close();
  });
});
