import "server-only";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import { createSqliteSettingsRepository } from "../db/repositories/index.js";
import { type Settings, DEFAULT_SETTINGS, parseSettings } from "../../domain/settings/settings.js";

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  await ensureSeeded(db);
  const settings = await createSqliteSettingsRepository(db).get();
  return settings ?? DEFAULT_SETTINGS;
}

export async function saveSettings(raw: unknown): Promise<Settings> {
  const validated = parseSettings(raw);
  const db = await getDb();
  await createSqliteSettingsRepository(db).save(validated);
  return validated;
}
