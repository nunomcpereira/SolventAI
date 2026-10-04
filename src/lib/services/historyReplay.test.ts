import { describe, expect, it } from "vitest";
import { reconstructAsOf } from "./historyReplay.js";
import { type EntityHistoryEntry } from "../../domain/history/entityHistory.js";

function entry(overrides: Partial<EntityHistoryEntry>): EntityHistoryEntry {
  return {
    id: "row-1",
    entityType: "expense",
    entityId: "exp-1",
    changeType: "save",
    recordedAt: "2026-01-01T00:00:00.000Z",
    snapshot: { amount: 1 },
    ...overrides,
  };
}

describe("reconstructAsOf", () => {
  it("returns each entity's latest snapshot at or before the given timestamp", () => {
    const rows: EntityHistoryEntry[] = [
      entry({ entityId: "exp-1", recordedAt: "2026-01-01T00:00:00.000Z", snapshot: { amount: 1 } }),
      entry({ entityId: "exp-2", recordedAt: "2026-02-01T00:00:00.000Z", snapshot: { amount: 5 } }),
      entry({ entityId: "exp-1", recordedAt: "2026-03-01T00:00:00.000Z", snapshot: { amount: 2 } }),
    ];

    const asOfFeb = reconstructAsOf(rows, "2026-02-15T00:00:00.000Z", (raw) => raw as { amount: number });
    expect(asOfFeb.get("exp-1")).toEqual({ amount: 1 });
    expect(asOfFeb.get("exp-2")).toEqual({ amount: 5 });

    const asOfApr = reconstructAsOf(rows, "2026-04-01T00:00:00.000Z", (raw) => raw as { amount: number });
    expect(asOfApr.get("exp-1")).toEqual({ amount: 2 });
  });

  it("excludes an entity if its latest row at that time was a delete", () => {
    const rows: EntityHistoryEntry[] = [
      entry({ entityId: "exp-1", recordedAt: "2026-01-01T00:00:00.000Z", changeType: "save" }),
      entry({ entityId: "exp-1", recordedAt: "2026-02-01T00:00:00.000Z", changeType: "delete" }),
    ];

    expect(reconstructAsOf(rows, "2026-01-15T00:00:00.000Z", (raw) => raw).get("exp-1")).toBeDefined();
    expect(reconstructAsOf(rows, "2026-03-01T00:00:00.000Z", (raw) => raw).get("exp-1")).toBeUndefined();
  });

  it("returns nothing for a timestamp before the entity existed", () => {
    const rows: EntityHistoryEntry[] = [entry({ entityId: "exp-1", recordedAt: "2026-06-01T00:00:00.000Z" })];
    expect(reconstructAsOf(rows, "2026-01-01T00:00:00.000Z", (raw) => raw).size).toBe(0);
  });
});
