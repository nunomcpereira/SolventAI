import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cookies } from "next/headers";
import { openDatabase, type Database } from "../db/client.js";

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
export async function getDb(): Promise<Database> {
  const path = process.env["SOLVENT_DB_PATH"] ?? tenantDbPath(await currentTenantId());
  return openTenantDb(path);
}

/** Opens (creating + migrating if needed) a specific tenant's database without going
 * through the current-tenant cookie — used when creating a new tenant. */
export function getDbForTenant(tenantId: string): Database {
  return openTenantDb(tenantDbPath(tenantId));
}
