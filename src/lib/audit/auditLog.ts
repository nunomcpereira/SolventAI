import { type EntityHistoryEntry, type EntityType } from "../../domain/history/entityHistory.js";

/**
 * Turns the append-only snapshot history (entity_history) into a human audit log: for each
 * save, what changed compared with that entity's previous snapshot. Pure — the page formats
 * values and labels; this only decides what changed and when.
 */

export type AuditAction = "created" | "updated" | "deleted";

export interface AuditChange {
  /** Dotted path into the serialized entity, e.g. "rate.currentIndexRate" or "events[ev-1]". */
  path: string;
  before: unknown;
  after: unknown;
}

export interface AuditEvent {
  id: string;
  recordedAt: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  /** The entity's state after the change (before it, for deletions). */
  snapshot: unknown;
  /** Field-level differences; empty for created/deleted. */
  changes: AuditChange[];
}

type Flat = Map<string, unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Money ({minorUnits, currency}) is one value, not two fields. */
const isMoney = (value: unknown): boolean =>
  isPlainObject(value) && typeof value["minorUnits"] === "string" && typeof value["currency"] === "string" && Object.keys(value).length === 2;

const hasId = (value: unknown): value is { id: string } => isPlainObject(value) && typeof value["id"] === "string";

/**
 * Flattens a snapshot to path → leaf. Arrays of objects with an `id` (scenario events, loan
 * fees) are keyed by id so an added/removed/edited item is one change, not a reshuffle of
 * every index after it. Other arrays (e.g. custom category names) are compared whole.
 */
function flatten(value: unknown, prefix = "", out: Flat = new Map()): Flat {
  if (isPlainObject(value) && !isMoney(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (Array.isArray(value) && value.length > 0 && value.every(hasId)) {
    for (const item of value) out.set(`${prefix}[${item.id}]`, item);
    return out;
  }
  out.set(prefix, value);
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Field-level differences between two snapshots of the same entity. */
export function diffSnapshots(before: unknown, after: unknown): AuditChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const changes: AuditChange[] = [];
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    if (path === "id") continue;
    const left = a.get(path);
    const right = b.get(path);
    if (!same(left, right)) changes.push({ path, before: left, after: right });
  }
  return changes;
}

/**
 * Builds audit events, newest first. A save with no previous snapshot (or right after a
 * delete) is "created"; a save identical to the previous one is dropped (the app re-saves
 * unchanged rows, e.g. every account when the default account changes).
 */
export function buildAuditEvents(entries: readonly EntityHistoryEntry[]): AuditEvent[] {
  const last = new Map<string, EntityHistoryEntry>();
  const events: AuditEvent[] = [];

  for (const entry of entries) {
    const key = `${entry.entityType}:${entry.entityId}`;
    const previous = last.get(key);
    last.set(key, entry);

    // A baseline is only a reference point for the next change, not something the user did.
    if (entry.changeType === "baseline") continue;
    if (entry.changeType === "delete") {
      events.push({ ...base(entry), action: "deleted", changes: [] });
      continue;
    }
    if (!previous || previous.changeType === "delete") {
      events.push({ ...base(entry), action: "created", changes: [] });
      continue;
    }
    const changes = diffSnapshots(previous.snapshot, entry.snapshot);
    if (changes.length > 0) events.push({ ...base(entry), action: "updated", changes });
  }
  return events.reverse();
}

function base(entry: EntityHistoryEntry) {
  return {
    id: entry.id,
    recordedAt: entry.recordedAt,
    entityType: entry.entityType,
    entityId: entry.entityId,
    snapshot: entry.snapshot,
  };
}
