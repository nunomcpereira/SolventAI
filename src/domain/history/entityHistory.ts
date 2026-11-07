import { z } from "zod";

export const ENTITY_TYPES = ["account", "income", "expense", "loan", "scenario", "settings"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const CHANGE_TYPES = ["save", "delete", "baseline"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/**
 * One append-only audit row: `entityId`'s full serialized state at `recordedAt`, either
 * because it was created/updated (`"save"`), because it was about to be deleted and
 * `snapshot` is its last known state (`"delete"`), or as a starting point recorded for an
 * entity that existed before it was tracked (`"baseline"`, see historyBaseline.ts). `snapshot` is left as `unknown` here —
 * it's each domain module's own `Serialized*` JSON shape, re-parsed by callers via that
 * module's own `parse*` function rather than validated generically.
 */
export interface EntityHistoryEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  changeType: ChangeType;
  recordedAt: string;
  snapshot: unknown;
}

const entityHistoryRowSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  changeType: z.enum(CHANGE_TYPES),
  recordedAt: z.string().min(1),
});

export function parseEntityHistoryEntry(raw: unknown, snapshot: unknown): EntityHistoryEntry {
  return { ...entityHistoryRowSchema.parse(raw), snapshot };
}
