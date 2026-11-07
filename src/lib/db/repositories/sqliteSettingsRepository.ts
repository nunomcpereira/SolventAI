import { type Database } from "../client.js";
import { createSqliteEntityHistoryRepository } from "./sqliteEntityHistoryRepository.js";
import { type Settings, type SettingsRepository, parseSettings, DEFAULT_SETTINGS, serializeSettings } from "../../../domain/settings/settings.js";

interface SettingsRow {
  base_currency: string;
  rounding_mode: string;
  day_count_default: string;
  language: string;
  account_type_labels_json?: string;
  loan_category_labels_json?: string;
  custom_loan_categories_json?: string;
  custom_income_categories_json?: string;
  llm_endpoint: string;
  llm_enabled: number;
  allow_cloud_llm_fallback: number;
}

function rowToSettings(row: SettingsRow): Settings {
  const accountTypeLabels = tryParseJson<Record<string, string>>(row.account_type_labels_json) ?? DEFAULT_SETTINGS.accountTypeLabels;
  const loanCategoryLabels = tryParseJson<Record<string, string>>(row.loan_category_labels_json) ?? DEFAULT_SETTINGS.loanCategoryLabels;
  const customLoanCategories = tryParseJson<string[]>(row.custom_loan_categories_json) ?? DEFAULT_SETTINGS.customLoanCategories;
  const customIncomeCategories = tryParseJson<string[]>(row.custom_income_categories_json) ?? DEFAULT_SETTINGS.customIncomeCategories;

  return parseSettings({
    baseCurrency: row.base_currency,
    roundingMode: row.rounding_mode,
    dayCountDefault: row.day_count_default,
    language: row.language,
    accountTypeLabels,
    loanCategoryLabels,
    customLoanCategories,
    customIncomeCategories,
    llmEndpoint: row.llm_endpoint,
    llmEnabled: row.llm_enabled === 1,
    allowCloudLlmFallback: row.allow_cloud_llm_fallback === 1,
  });
}

function tryParseJson<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function createSqliteSettingsRepository(db: Database): SettingsRepository {
  const history = createSqliteEntityHistoryRepository(db);

  return {
    async get(): Promise<Settings | undefined> {
      const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow | undefined;
      return row ? rowToSettings(row) : undefined;
    },

    async save(settings: Settings): Promise<void> {
      const validated = parseSettings(settings);
      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO settings (
             id,
             base_currency,
             rounding_mode,
             day_count_default,
             language,
             account_type_labels_json,
             loan_category_labels_json,
             custom_loan_categories_json,
             custom_income_categories_json,
             llm_endpoint,
             llm_enabled,
             allow_cloud_llm_fallback
           )
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             base_currency = excluded.base_currency,
             rounding_mode = excluded.rounding_mode,
             day_count_default = excluded.day_count_default,
             language = excluded.language,
             account_type_labels_json = excluded.account_type_labels_json,
             loan_category_labels_json = excluded.loan_category_labels_json,
             custom_loan_categories_json = excluded.custom_loan_categories_json,
             custom_income_categories_json = excluded.custom_income_categories_json,
             llm_endpoint = excluded.llm_endpoint,
             llm_enabled = excluded.llm_enabled,
             allow_cloud_llm_fallback = excluded.allow_cloud_llm_fallback`,
        ).run(
          validated.baseCurrency,
          validated.roundingMode,
          validated.dayCountDefault,
          validated.language,
          JSON.stringify(validated.accountTypeLabels),
          JSON.stringify(validated.loanCategoryLabels),
          JSON.stringify(validated.customLoanCategories),
          JSON.stringify(validated.customIncomeCategories),
          validated.llmEndpoint,
          validated.llmEnabled ? 1 : 0,
          validated.allowCloudLlmFallback ? 1 : 0,
        );
        history.record({ entityType: "settings", entityId: "settings", changeType: "save", snapshot: serializeSettings(validated) });
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
