import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";
import { ensureHistoryBaselines } from "./historyBaseline.js";
import { createSqliteEntityHistoryRepository } from "./repositories/sqliteEntityHistoryRepository.js";

describe("ensureHistoryBaselines", () => {
  it("records one baseline per untracked entity, and is idempotent", async () => {
    const db = openDatabase(":memory:");
    // Rows written straight to the tables, as data created before history existed would be.
    db.exec(`
      INSERT INTO accounts (id, name, type, currency, initial_balance_minor_units, minimum_reserve_minor_units, active, is_default)
      VALUES ('a1', 'CGD', 'checking', 'EUR', '100', '0', 1, 1);
      INSERT INTO scenarios (id, name, base_scenario_id, events_json) VALUES ('s1', 'Plan', NULL, '[]');
    `);

    expect(await ensureHistoryBaselines(db)).toBe(2);
    expect(await ensureHistoryBaselines(db)).toBe(0);

    const rows = await createSqliteEntityHistoryRepository(db).listAll();
    expect(rows.map((r) => [r.entityType, r.entityId, r.changeType])).toEqual([
      ["account", "a1", "baseline"],
      ["scenario", "s1", "baseline"],
    ]);
  });

  it("skips entities that already have history", async () => {
    const db = openDatabase(":memory:");
    db.exec(`INSERT INTO scenarios (id, name, base_scenario_id, events_json) VALUES ('s1', 'Plan', NULL, '[]');`);
    createSqliteEntityHistoryRepository(db).record({ entityType: "scenario", entityId: "s1", changeType: "save", snapshot: {} });
    expect(await ensureHistoryBaselines(db)).toBe(0);
  });
});
