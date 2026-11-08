import { copyFileSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { openDatabase, openRawDatabase, type Database } from "./client.js";
import { MIGRATIONS } from "./migrations.js";

/** First 16 bytes of every SQLite 3 database file. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "binary");

/** Upper bound for an uploaded backup — far above any realistic household dataset. */
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

export type BackupValidationError =
  | "too-large"
  | "not-sqlite"
  | "corrupt"
  | "not-solvent"
  | "newer-version";

export type BackupValidation = { ok: true } | { ok: false; error: BackupValidationError };

/**
 * Writes a consistent, compacted copy of `db` to `destPath` (which must not exist).
 * `VACUUM INTO` reads through SQLite's own transaction machinery, so the copy is
 * consistent even with WAL frames not yet checkpointed into the main file.
 */
export function snapshotDatabase(db: Database, destPath: string): void {
  db.prepare("VACUUM INTO ?").run(destPath);
}

/** Cheap header check, done before writing an upload anywhere. */
export function looksLikeSqlite(bytes: Uint8Array): boolean {
  return bytes.length >= SQLITE_MAGIC.length && Buffer.from(bytes.subarray(0, SQLITE_MAGIC.length)).equals(SQLITE_MAGIC);
}

/**
 * Checks that the file at `path` is an intact SolventAI database this build can open:
 * a SQLite file that passes `integrity_check`, has a `schema_migrations` table, and
 * contains no migration this build doesn't know (a backup from a newer version would
 * have tables/columns the code can't read, and migrations can't run backwards).
 * Opens the file without running migrations, so validation never modifies it.
 */
export function validateBackupFile(path: string): BackupValidation {
  const header = readFileSync(path).subarray(0, SQLITE_MAGIC.length);
  if (!looksLikeSqlite(header)) return { ok: false, error: "not-sqlite" };

  let db: Database | undefined;
  try {
    db = openRawDatabase(path, { readOnly: true });
    const integrity = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") return { ok: false, error: "corrupt" };

    const hasMigrations = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (hasMigrations === undefined) return { ok: false, error: "not-solvent" };

    const known = new Set(MIGRATIONS.map((m) => m.id));
    const applied = (db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((r) => r.id);
    if (applied.length === 0) return { ok: false, error: "not-solvent" };
    if (applied.some((id) => !known.has(id))) return { ok: false, error: "newer-version" };
    return { ok: true };
  } catch {
    return { ok: false, error: "corrupt" };
  } finally {
    db?.close();
  }
}

function removeSidecars(path: string): void {
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

/**
 * Replaces the database at `targetPath` with the validated backup at `sourcePath`.
 * The caller must have closed every connection to `targetPath` first. If a database
 * already exists there, it's first copied to `<targetPath>.backup-<timestamp>` so a
 * mistaken restore can be undone by hand. Returns that safety-copy path, if any.
 * The restored file is opened once (running any pending migrations) before returning,
 * so an older backup is brought up to the current schema immediately.
 */
export function installBackup(sourcePath: string, targetPath: string, now: Date = new Date()): string | undefined {
  let safetyCopy: string | undefined;
  if (existsSync(targetPath)) {
    safetyCopy = `${targetPath}.backup-${now.toISOString().replace(/[:.]/g, "-")}`;
    const current = openRawDatabase(targetPath);
    try {
      snapshotDatabase(current, safetyCopy);
    } finally {
      current.close();
    }
  }
  // Copy beside the target first so the final swap is a same-filesystem (atomic) rename.
  const staged = `${targetPath}.restoring`;
  copyFileSync(sourcePath, staged);
  removeSidecars(targetPath);
  renameSync(staged, targetPath);
  openDatabase(targetPath).close();
  return safetyCopy;
}
