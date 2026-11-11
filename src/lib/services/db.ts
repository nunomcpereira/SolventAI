import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cookies, headers } from "next/headers";
import { openDatabase, type Database } from "../db/client.js";
import { ensureHistoryBaselines } from "../db/historyBaseline.js";
import { buildAsOfDatabase } from "../db/asOfDatabase.js";
import { BEFORE_HEADER, parseBefore } from "../history/versionParam.js";

export const DATA_DIR = process.env["SOLVENT_DATA_DIR"] ?? "./data";
export const DEFAULT_TENANT_ID = "solvent";
export const TENANT_COOKIE_NAME = "solvent_tenant";

const connections = new Map<string, Database>();

export function tenantDbPath(tenantId: string): string {
  return join(DATA_DIR, `${tenantId}.db`);
}

/** Reads the selected tenant from its cookie, defaulting to the original single-tenant
 * database. `SOLVENT_DB_PATH` (used by e2e tests to point at a scratch DB) always wins,
 * bypassing tenant selection entirely. */
export async function currentTenantId(): Promise<string> {
  if (process.env["SOLVENT_DB_PATH"]) return DEFAULT_TENANT_ID;
  const store = await cookies();
  const raw = store.get(TENANT_COOKIE_NAME)?.value;
  return raw !== undefined && /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : DEFAULT_TENANT_ID;
}

function openTenantDb(path: string): Database {
  let db = connections.get(path);
  if (db === undefined) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    db = openDatabase(path);
    connections.set(path, db);
  }
  return db;
}

/** Connection to the currently-selected tenant's local SQLite database (spec section
 * 26), cached per tenant for the life of the process. */
const baselined = new Map<string, Promise<unknown>>();

/** Filesystem path of the currently-selected tenant's database. */
export async function currentDbPath(): Promise<string> {
  return process.env["SOLVENT_DB_PATH"] ?? tenantDbPath(await currentTenantId());
}

/** Closes and forgets the cached connection for `path`, so the next `getDb()` reopens
 * (and re-migrates) whatever file is at that path — used after a backup restore. */
export function closeDb(path: string): void {
  const db = connections.get(path);
  connections.delete(path);
  baselined.delete(path);
  closeAsOfDbs(path);
  db?.close();
}

/** Read-only past versions (see asOfDatabase.ts), by "<db path>|<before>"; a few at most. */
const asOfConnections = new Map<string, Promise<Database>>();
const MAX_AS_OF_CONNECTIONS = 4;

/** The `?before=` timestamp of the current request, if any (forwarded by middleware.ts). */
export async function requestedBefore(): Promise<string | undefined> {
  try {
    return parseBefore((await headers()).get(BEFORE_HEADER));
  } catch {
    return undefined; // outside a request (scripts, tests)
  }
}

function getAsOfDb(path: string, live: Database, before: string): Promise<Database> {
  const key = `${path}|${before}`;
  let pending = asOfConnections.get(key);
  if (pending === undefined) {
    // Make sure WAL frames are visible to the separate connection that ATTACH opens.
    if (path !== ":memory:") live.exec("PRAGMA wal_checkpoint(PASSIVE);");
    pending = buildAsOfDatabase(path, before);
    pending.catch(() => asOfConnections.delete(key));
    asOfConnections.set(key, pending);
    while (asOfConnections.size > MAX_AS_OF_CONNECTIONS) {
      const [oldestKey, oldest] = asOfConnections.entries().next().value!;
      asOfConnections.delete(oldestKey);
      void oldest.then((d) => d.close(), () => undefined);
    }
  }
  return pending;
}

/** Drops every cached past version of `path` (its data changed, e.g. after a restore). */
function closeAsOfDbs(path: string): void {
  for (const [key, pending] of asOfConnections) {
    if (!key.startsWith(`${path}|`)) continue;
    asOfConnections.delete(key);
    void pending.then((d) => d.close(), () => undefined);
  }
}

/** Connection for the current request: the tenant's live database, or — when the URL
 * carries `?before=` — a read-only copy of it as it was just before that instant. */
export async function getDb(): Promise<Database> {
  const path = await currentDbPath();
  const db = openTenantDb(path);
  // Once per connection: give pre-existing data a history starting point (see historyBaseline.ts).
  let pending = baselined.get(path);
  if (pending === undefined) {
    pending = ensureHistoryBaselines(db);
    baselined.set(path, pending);
  }
  await pending;
  const before = await requestedBefore();
  if (before && path !== ":memory:") return getAsOfDb(path, db, before);
  return db;
}

/** Opens (creating + migrating if needed) a specific tenant's database without going
 * through the current-tenant cookie — used when creating a new tenant. */
export function getDbForTenant(tenantId: string): Database {
  return openTenantDb(tenantDbPath(tenantId));
}
