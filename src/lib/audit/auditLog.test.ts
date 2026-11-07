import { describe, expect, it } from "vitest";
import { buildAuditEvents, diffSnapshots } from "./auditLog.js";
import { type EntityHistoryEntry } from "../../domain/history/entityHistory.js";

let seq = 0;
function entry(partial: Partial<EntityHistoryEntry> & Pick<EntityHistoryEntry, "entityType" | "entityId" | "snapshot">): EntityHistoryEntry {
  seq += 1;
  return {
    id: `h${seq}`,
    changeType: "save",
    recordedAt: `2026-11-07T10:00:${String(seq).padStart(2, "0")}.000Z`,
    ...partial,
  };
}

const money = (minorUnits: string) => ({ minorUnits, currency: "EUR" });

describe("diffSnapshots", () => {
  it("treats money as one value and reports nested rate fields by path", () => {
    const before = { id: "l1", name: "CGD", principal: money("20000000"), rate: { type: "mixed", currentIndexRate: "0.02683", spread: "0.007" } };
    const after = { ...before, rate: { ...before.rate, currentIndexRate: "0.03016" } };
    expect(diffSnapshots(before, after)).toEqual([{ path: "rate.currentIndexRate", before: "0.02683", after: "0.03016" }]);

    const paid = { ...before, principal: money("19000000") };
    expect(diffSnapshots(before, paid)).toEqual([{ path: "principal", before: money("20000000"), after: money("19000000") }]);
  });

  it("keys arrays of identified items by id: one change per added, removed or edited item", () => {
    const e1 = { id: "e1", date: "2027-01-01", payload: { type: "one_time_expense", amount: money("100000") } };
    const e2 = { id: "e2", date: "2027-02-01", payload: { type: "one_time_income", amount: money("50000") } };
    const before = { id: "s1", name: "Plan", events: [e1, e2] };
    const after = { id: "s1", name: "Plan", events: [{ ...e2, date: "2027-03-01" }] };
    expect(diffSnapshots(before, after)).toEqual([
      { path: "events[e1]", before: e1, after: undefined },
      { path: "events[e2]", before: e2, after: { ...e2, date: "2027-03-01" } },
    ]);
  });

  it("compares plain arrays whole and ignores the id field", () => {
    expect(diffSnapshots({ id: "a", custom: ["x"] }, { id: "b", custom: ["x", "y"] })).toEqual([
      { path: "custom", before: ["x"], after: ["x", "y"] },
    ]);
  });

  it("reports a field that appears or disappears", () => {
    expect(diffSnapshots({ endDate: "2027-01-01" }, {})).toEqual([{ path: "endDate", before: "2027-01-01", after: undefined }]);
  });
});

describe("buildAuditEvents", () => {
  it("classifies created, updated and deleted, newest first, and drops no-op saves", () => {
    const acc = { id: "a1", name: "CGD", initialBalance: money("100") };
    const events = buildAuditEvents([
      entry({ entityType: "account", entityId: "a1", snapshot: acc }),
      entry({ entityType: "account", entityId: "a1", snapshot: acc }), // re-save, nothing changed
      entry({ entityType: "account", entityId: "a1", snapshot: { ...acc, initialBalance: money("250") } }),
      entry({ entityType: "account", entityId: "a1", changeType: "delete", snapshot: { ...acc, initialBalance: money("250") } }),
      entry({ entityType: "account", entityId: "a1", snapshot: acc }), // recreated with the same id
    ]);

    expect(events.map((e) => e.action)).toEqual(["created", "deleted", "updated", "created"]);
    expect(events[2]?.changes).toEqual([{ path: "initialBalance", before: money("100"), after: money("250") }]);
    expect(events[0]!.recordedAt > events[3]!.recordedAt).toBe(true);
  });

  it("tracks each entity separately", () => {
    const events = buildAuditEvents([
      entry({ entityType: "loan", entityId: "l1", snapshot: { name: "A" } }),
      entry({ entityType: "scenario", entityId: "l1", snapshot: { name: "A" } }),
      entry({ entityType: "loan", entityId: "l1", snapshot: { name: "B" } }),
    ]);
    expect(events.map((e) => `${e.entityType}:${e.action}`)).toEqual(["loan:updated", "scenario:created", "loan:created"]);
  });
});

describe("baselines", () => {
  it("are not events, but give the next change its 'before'", () => {
    const loan = { name: "CGD", rate: { currentIndexRate: "0.02683" } };
    const events = buildAuditEvents([
      entry({ entityType: "loan", entityId: "l1", changeType: "baseline", snapshot: loan }),
      entry({ entityType: "loan", entityId: "l1", snapshot: { ...loan, rate: { currentIndexRate: "0.03016" } } }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("updated");
    expect(events[0]?.changes).toEqual([{ path: "rate.currentIndexRate", before: "0.02683", after: "0.03016" }]);
  });
});
