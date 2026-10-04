import "server-only";
import { readdirSync } from "node:fs";
import { DATA_DIR, DEFAULT_TENANT_ID, currentTenantId, getDbForTenant } from "./db.js";
import { ensureSeeded } from "./seed.js";

/** Filenames in DATA_DIR that are never real tenants — the e2e scratch DB and
 * SQLite's own WAL/SHM sidecar files. Timestamped ".backup-*" files don't match the
 * ".db" suffix check below, so they're excluded without needing to be listed here. */
const EXCLUDED_FILENAMES = new Set(["e2e-test.db"]);

export interface TenantOption {
  id: string;
  name: string;
}

function prettifyTenantId(id: string): string {
  if (id === DEFAULT_TENANT_ID) return "Default";
  return id
    .split(/[-_]/)
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Lists every tenant database file found in DATA_DIR, always including the default
 * tenant even if its file doesn't exist yet (it's created lazily on first write). */
export function listTenants(): TenantOption[] {
  const ids = new Set<string>([DEFAULT_TENANT_ID]);
  try {
    for (const entry of readdirSync(DATA_DIR)) {
      if (!entry.endsWith(".db") || EXCLUDED_FILENAMES.has(entry)) continue;
      ids.add(entry.slice(0, -".db".length));
    }
  } catch {
    // DATA_DIR not created yet — only the default tenant exists.
  }
  return Array.from(ids)
    .sort((a, b) => (a === DEFAULT_TENANT_ID ? -1 : b === DEFAULT_TENANT_ID ? 1 : a.localeCompare(b)))
    .map((id) => ({ id, name: prettifyTenantId(id) }));
}

export { currentTenantId as getCurrentTenantId };

/** Creates (or reuses, if it already exists) a "demo" tenant database and seeds it
 * with the app's built-in illustrative demo data — a safe space to show off features
 * without touching real financial data. Returns the tenant id to switch to. */
export async function createDemoTenant(): Promise<string> {
  const existingIds = new Set(listTenants().map((t) => t.id));
  let id = "demo";
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `demo-${suffix}`;
    suffix += 1;
  }
  const db = getDbForTenant(id);
  await ensureSeeded(db);
  return id;
}
