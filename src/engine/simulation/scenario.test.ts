import { describe, expect, it } from "vitest";
import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { withAddedEvent, withRemovedEvent, withUpdatedEvent, deriveScenario, type Scenario } from "./scenario.js";
import { type SimulationEvent } from "./events.js";

function baseScenario(): Scenario {
  return { id: "base", name: "Base", events: [] };
}

function evt(id: string): SimulationEvent {
  return {
    id,
    date: IsoDate.fromString("2026-01-01"),
    payload: { type: "one_time_income", accountId: "a", amount: Money.fromDecimalString("100.00", "EUR") },
  };
}

describe("scenario edit helpers", () => {
  it("withAddedEvent returns a new object and does not mutate the original", () => {
    const scenario = baseScenario();
    const updated = withAddedEvent(scenario, evt("e1"));
    expect(scenario.events).toHaveLength(0);
    expect(updated.events).toHaveLength(1);
    expect(updated).not.toBe(scenario);
  });

  it("withAddedEvent rejects duplicate event ids", () => {
    const scenario = withAddedEvent(baseScenario(), evt("e1"));
    expect(() => withAddedEvent(scenario, evt("e1"))).toThrow();
  });

  it("withRemovedEvent removes only the targeted event, immutably", () => {
    let scenario = withAddedEvent(baseScenario(), evt("e1"));
    scenario = withAddedEvent(scenario, evt("e2"));
    const updated = withRemovedEvent(scenario, "e1");
    expect(updated.events.map((e) => e.id)).toEqual(["e2"]);
    expect(scenario.events.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("withUpdatedEvent applies the updater and throws for unknown id", () => {
    const scenario = withAddedEvent(baseScenario(), evt("e1"));
    const updated = withUpdatedEvent(scenario, "e1", (e) => ({ ...e, date: IsoDate.fromString("2027-01-01") }));
    expect(updated.events[0]!.date.toString()).toBe("2027-01-01");
    expect(scenario.events[0]!.date.toString()).toBe("2026-01-01");
    expect(() => withUpdatedEvent(scenario, "nope", (e) => e)).toThrow();
  });

  it("deriveScenario forks a new scenario sharing events, tracking baseScenarioId", () => {
    const base = withAddedEvent(baseScenario(), evt("e1"));
    const derived = deriveScenario(base, "derived", "Derived");
    expect(derived.baseScenarioId).toBe("base");
    expect(derived.events).toEqual(base.events);
    expect(derived.events).not.toBe(base.events);
  });
});
