import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import { createSqliteScenarioRepository } from "./sqliteScenarioRepository.js";
import { parseScenario } from "../../../domain/scenarios/scenario.js";

function validScenario(id = "scn-1") {
  return parseScenario({
    id,
    name: "Rate shock",
    events: [
      {
        id: "e1",
        date: "2026-06-01",
        payload: { type: "rate_change", loanId: "loan-1", index: "EURIBOR_6M", newAnnualValue: "0.045" },
      },
    ],
  });
}

describe("SqliteScenarioRepository", () => {
  it("round-trips a scenario with engine-typed event payloads", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteScenarioRepository(db);
    const scenario = validScenario();
    await repo.save(scenario);
    expect(await repo.findById("scn-1")).toEqual(scenario);
  });

  it("upserts on re-save and list returns all scenarios", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteScenarioRepository(db);
    await repo.save(validScenario("scn-1"));
    await repo.save(validScenario("scn-2"));
    expect((await repo.list()).map((s) => s.id).sort()).toEqual(["scn-1", "scn-2"]);
  });

  it("delete removes the scenario", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteScenarioRepository(db);
    await repo.save(validScenario());
    await repo.delete("scn-1");
    expect(await repo.findById("scn-1")).toBeUndefined();
  });
});
