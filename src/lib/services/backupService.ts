import "server-only";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  MAX_BACKUP_BYTES,
  installBackup,
  looksLikeSqlite,
  snapshotDatabase,
  validateBackupFile,
  type BackupValidationError,
} from "../db/backup.js";
import { closeDb, currentDbPath, getDb } from "./db.js";
import { emitChange } from "./changeEvents.js";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "solvent-backup-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A consistent copy of the current tenant's database, ready to download. */
export async function exportCurrentDatabase(now: Date = new Date()): Promise<{ fileName: string; bytes: Buffer }> {
  const db = await getDb();
  const tenant = basename(await currentDbPath(), ".db");
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const bytes = withTempDir((dir) => {
    const out = join(dir, "export.db");
    snapshotDatabase(db, out);
    return readFileSync(out);
  });
  return { fileName: `solvent-${tenant}-${stamp}.db`, bytes };
}

export type RestoreResult = { ok: true; safetyCopy?: string } | { ok: false; error: BackupValidationError };

/** Replaces the current tenant's database with an uploaded backup, after validating it.
 * The previous database is kept beside it as `<name>.db.backup-<timestamp>`. */
export async function restoreCurrentDatabase(bytes: Uint8Array): Promise<RestoreResult> {
  if (bytes.length > MAX_BACKUP_BYTES) return { ok: false, error: "too-large" };
  if (!looksLikeSqlite(bytes)) return { ok: false, error: "not-sqlite" };

  const target = await currentDbPath();
  const result = withTempDir((dir): RestoreResult => {
    const staged = join(dir, "restore.db");
    writeFileSync(staged, bytes);
    const validation = validateBackupFile(staged);
    if (!validation.ok) return validation;
    closeDb(target);
    const safetyCopy = installBackup(staged, target);
    return safetyCopy === undefined ? { ok: true } : { ok: true, safetyCopy: basename(safetyCopy) };
  });

  if (result.ok) {
    for (const scope of ["accounts", "loans", "upload"]) emitChange(scope);
  }
  return result;
}
