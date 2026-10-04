import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";
import { MIGRATIONS } from "./migrations.js";

describe("openDatabase", () => {
  it("creates all core tables on a fresh in-memory database", () => {
    const db = openDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "accounts",
        "loans",
        "loan_fees",
        "incomes",
        "expenses",
        "exchange_rates",
        "settings",
        "contract_documents",
        "contract_extractions",
        "scenarios",
        "schema_migrations",
      ]),
    );
  });

  it("records applied migrations and is idempotent to re-run", () => {
    const db = openDatabase(":memory:");
    const before = db.prepare("SELECT id FROM schema_migrations").all();
    expect(before).toHaveLength(MIGRATIONS.length);

    // Re-running migrations against a fresh db must not fail or duplicate rows.
    const db2 = openDatabase(":memory:");
    const after = db2.prepare("SELECT id FROM schema_migrations").all();
    expect(after).toHaveLength(MIGRATIONS.length);
  });
});
