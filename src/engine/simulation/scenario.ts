import { type SimulationEvent, orderEvents } from "./events.js";

/**
 * A scenario is base state (accounts/loans/income/expenses, owned outside this
 * module) plus an ordered set of events (spec section 20). The base scenario is
 * immutable: every edit helper below returns a NEW Scenario, never mutates the input,
 * so a caller can hold a reference to a prior version for comparison/undo.
 */
export interface Scenario {
  id: string;
  name: string;
  /** id of the scenario this was derived from, if any. The base scenario has none. */
  baseScenarioId?: string;
  events: SimulationEvent[];
}

/** Events in canonical deterministic order (see engine/simulation/events.ts). */
export function orderedEvents(scenario: Scenario): SimulationEvent[] {
  return orderEvents(scenario.events);
}

export function withAddedEvent(scenario: Scenario, event: SimulationEvent): Scenario {
  if (scenario.events.some((e) => e.id === event.id)) {
    throw new Error(`withAddedEvent: event id "${event.id}" already exists in scenario "${scenario.id}"`);
  }
  return { ...scenario, events: [...scenario.events, event] };
}

export function withRemovedEvent(scenario: Scenario, eventId: string): Scenario {
  return { ...scenario, events: scenario.events.filter((e) => e.id !== eventId) };
}

export function withUpdatedEvent(
  scenario: Scenario,
  eventId: string,
  updater: (event: SimulationEvent) => SimulationEvent,
): Scenario {
  let found = false;
  const events = scenario.events.map((e) => {
    if (e.id !== eventId) return e;
    found = true;
    return updater(e);
  });
  if (!found) {
    throw new Error(`withUpdatedEvent: event id "${eventId}" not found in scenario "${scenario.id}"`);
  }
  return { ...scenario, events };
}

/** Creates a new scenario derived from `base`, sharing its events by default (a fork point). */
export function deriveScenario(base: Scenario, newId: string, newName: string): Scenario {
  return { id: newId, name: newName, baseScenarioId: base.id, events: [...base.events] };
}
