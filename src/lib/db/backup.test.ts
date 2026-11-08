import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, openRawDatabase } from "./client.js";
import { installBackup, looksLikeSqlite, snapshotDatabase, validateBackupFile } from "./backup.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backup-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeSolventDb(path: string, accountName: string): void {
  const db = openDatabase(path);
  db.prepare(
    "INSERT INTO accounts (id, name, type, currency, initial_balance_minor_units, minimum_reserve_minor_units, active) VALUES (?, ?, 'checking', 'EUR', '100', '0', 1)",
  ).run(accountName, accountName);
  db.close();
}

function accountNames(path: string): string[] {
  const db = openRawDatabase(path, { readOnly: true });
  try {
    return (db.prepare("SELECT name FROM accounts ORDER BY name").all() as { name: string }[]).map((r) => r.name);
  } finally {
    db.close();
  }
}

describe("snapshotDatabase", () => {
  it("writes a consistent copy that validates and holds the same rows", () => {
    const live = join(dir, "live.db");
    makeSolventDb(live, "Main");
    const db = openDatabase(live);
    const copy = join(dir, "copy.db");
    snapshotDatabase(db, copy);
    db.close();
    expect(validateBackupFile(copy)).toEqual({ ok: true });
    expect(accountNames(copy)).toEqual(["Main"]);
  });
});

describe("validateBackupFile", () => {
  it("rejects a non-SQLite file", () => {
    const p = join(dir, "x.db");
    writeFileSync(p, "hello, not a database at all");
    expect(validateBackupFile(p)).toEqual({ ok: false, error: "not-sqlite" });
  });

  it("rejects a SQLite file that isn't a SolventAI database", () => {
    const p = join(dir, "other.db");
    const db = openRawDatabase(p);
    db.exec("CREATE TABLE notes (body TEXT)");
    db.close();
    expect(validateBackupFile(p)).toEqual({ ok: false, error: "not-solvent" });
  });

  it("rejects a backup made by a newer version (unknown migration)", () => {
    const p = join(dir, "newer.db");
    makeSolventDb(p, "A");
    const db = openRawDatabase(p);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES ('9999_future', '2030-01-01')").run();
    db.close();
    expect(validateBackupFile(p)).toEqual({ ok: false, error: "newer-version" });
  });

  it("rejects a truncated file", () => {
    const p = join(dir, "good.db");
    makeSolventDb(p, "A");
    const bad = join(dir, "bad.db");
    const bytes = readFileSync(p);
    writeFileSync(bad, bytes.subarray(0, 4096 + 100));
    expect(validateBackupFile(bad)).toMatchObject({ ok: false });
  });
});

describe("looksLikeSqlite", () => {
  it("checks the 16-byte header", () => {
    expect(looksLikeSqlite(Buffer.from("SQLite format 3\0rest", "binary"))).toBe(true);
    expect(looksLikeSqlite(Buffer.from("PK\u0003\u0004"))).toBe(false);
  });
});

describe("installBackup", () => {
  it("replaces the target, keeps a safety copy of the old data, and leaves no staging file", () => {
    const target = join(dir, "solvent.db");
    makeSolventDb(target, "Old");
    const backup = join(dir, "incoming.db");
    makeSolventDb(backup, "Restored");

    const safety = installBackup(backup, target, new Date("2026-11-08T10:00:00Z"));

    expect(accountNames(target)).toEqual(["Restored"]);
    expect(safety).toBeDefined();
    expect(accountNames(safety!)).toEqual(["Old"]);
    expect(readdirSync(dir).some((f) => f.endsWith(".restoring"))).toBe(false);
  });

  it("works when no database exists yet at the target", () => {
    const target = join(dir, "fresh.db");
    const backup = join(dir, "incoming.db");
    makeSolventDb(backup, "Restored");
    expect(installBackup(backup, target)).toBeUndefined();
    expect(existsSync(target)).toBe(true);
    expect(accountNames(target)).toEqual(["Restored"]);
  });

  it("accepts a backup from an older version (subset of known migrations)", () => {
    const backup = join(dir, "old.db");
    makeSolventDb(backup, "A");
    const db = openRawDatabase(backup);
    const last = db.prepare("SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1").get() as { id: string };
    db.prepare("DELETE FROM schema_migrations WHERE id = ?").run(last.id);
    db.close();

    expect(validateBackupFile(backup)).toEqual({ ok: true });
  });
});
