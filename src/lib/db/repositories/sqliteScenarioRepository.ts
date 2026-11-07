import { type Database } from "../client.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import {
  type Scenario,
  type ScenarioRepository,
  type ScenarioInput,
  parseScenario,
  serializeScenario,
} from "../../../domain/scenarios/scenario.js";

interface ScenarioRow {
  id: string;
  name: string;
  base_scenario_id: string | null;
  events_json: string;
}

function rowToScenario(row: ScenarioRow): Scenario {
  const events = JSON.parse(row.events_json) as ScenarioInput["events"];
  return parseScenario({
    id: row.id,
    name: row.name,
    ...(row.base_scenario_id !== null ? { baseScenarioId: row.base_scenario_id } : {}),
    events,
  });
}

export function createSqliteScenarioRepository(db: Database): ScenarioRepository {
  const history = createSqliteEntityHistoryRepository(db);

  return {
    async findById(id: string): Promise<Scenario | undefined> {
      const row = db.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as ScenarioRow | undefined;
      return row ? rowToScenario(row) : undefined;
    },

    async list(): Promise<Scenario[]> {
      const rows = db.prepare("SELECT * FROM scenarios ORDER BY name").all() as unknown as ScenarioRow[];
      return rows.map(rowToScenario);
    },

    async save(scenario: Scenario): Promise<void> {
      const s = serializeScenario(scenario);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO scenarios (id, name, base_scenario_id, events_json)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             base_scenario_id = excluded.base_scenario_id,
             events_json = excluded.events_json`,
        ).run(s.id, s.name, s.baseScenarioId ?? null, JSON.stringify(s.events));
        history.record({ entityType: "scenario", entityId: s.id, changeType: "save", snapshot: s });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async delete(id: string): Promise<void> {
      db.exec("BEGIN");
      try {
        const row = db.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as ScenarioRow | undefined;
        if (row) {
          history.record({ entityType: "scenario", entityId: id, changeType: "delete", snapshot: serializeScenario(rowToScenario(row)) });
        }
        db.prepare("DELETE FROM scenarios WHERE id = ?").run(id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
