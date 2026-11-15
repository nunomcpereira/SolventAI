import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type Database } from "./client.js";
import { buildAsOfDatabase } from "./asOfDatabase.js";
import { createSqliteAccountRepository } from "./repositories/sqliteAccountRepository.js";
import { createSqliteSettingsRepository } from "./repositories/sqliteSettingsRepository.js";
import { createSqliteEntityHistoryRepository } from "./repositories/sqliteEntityHistoryRepository.js";
import { parseAccount } from "../../domain/accounts/account.js";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.js";

const account = (id: string, name: string, balance: string) =>
  parseAccount({
    id,
    name,
    type: "checking",
    currency: "EUR",
    initialBalance: { minorUnits: balance, currency: "EUR" },
    minimumReserve: { minorUnits: "0", currency: "EUR" },
    active: true,
  });

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("buildAsOfDatabase", () => {
  const opened: Database[] = [];
  let dir: string | undefined;
  afterEach(() => {
    for (const db of opened.splice(0)) db.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("rebuilds tracked tables as they were just before the instant, read-only", async () => {
    dir = mkdtempSync(join(tmpdir(), "asof-"));
    const path = join(dir, "t.db");
    const live = openDatabase(path);
    opened.push(live);
    const accounts = createSqliteAccountRepository(live);
    await createSqliteSettingsRepository(live).save(DEFAULT_SETTINGS);
    await accounts.save(account("a1", "Checking", "100000"));
    await accounts.save(account("a2", "Savings", "500"));
    await tick();
    const history = createSqliteEntityHistoryRepository(live);
    const cut = new Date().toISOString();
    await tick();
    await accounts.save(account("a1", "Checking", "250000"));
    await accounts.delete("a2");
    await accounts.save(account("a3", "New", "1"));

    const past = await buildAsOfDatabase(path, cut);
    opened.push(past);
    const pastAccounts = await createSqliteAccountRepository(past).list();
    expect(pastAccounts.map((a) => [a.id, a.initialBalance.minorUnits.toString()]).sort()).toEqual([
      ["a1", "100000"],
      ["a2", "500"],
    ]);
    const pastHistory = await createSqliteEntityHistoryRepository(past).listAll();
    expect(pastHistory.every((row) => row.recordedAt < cut)).toBe(true);
    expect(pastHistory).toHaveLength((await history.listAll()).filter((r) => r.recordedAt < cut).length);
    expect(await createSqliteSettingsRepository(past).get()).toBeDefined();
    await expect(createSqliteAccountRepository(past).save(account("a9", "x", "1"))).rejects.toThrow();

    // The live database is untouched.
    expect((await accounts.list()).map((a) => a.id).sort()).toEqual(["a1", "a3"]);
  });
});
