import { createRequire } from "node:module";
import { MIGRATIONS } from "./migrations.js";

type SqliteModule = typeof import("node:sqlite");
export type Database = InstanceType<SqliteModule["DatabaseSync"]>;

/**
 * Loaded via Node's CJS `require`, not an ESM import, so that bundler tooling
 * (Vite/Vitest, which statically analyzes import/dynamic-import specifiers) never
 * tries to resolve "node:sqlite" as an npm package — it is a Node.js built-in not
 * yet listed in `module.builtinModules`, and `require` resolves it directly at
 * runtime without going through any bundler's module graph.
 */
function loadSqliteModule(): SqliteModule {
  const require = createRequire(import.meta.url);
  return require("node:sqlite") as SqliteModule;
}

/**
 * Opens a local SQLite database and applies any pending migrations. This is the only
 * place in the codebase that talks to node:sqlite directly — repositories receive an
 * already-open, already-migrated `Database` and never open their own connection.
 * `path` may be a filesystem path or ":memory:" (used by all repository tests).
 */
export function openDatabase(path: string): Database {
  const { DatabaseSync } = loadSqliteModule();
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 5000;");
  }
  runMigrations(db);
  return db;
}

function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedIds = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: string }).id),
  );

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${migration.id} failed: ${(error as Error).message}`, { cause: error });
    }
  }
}
