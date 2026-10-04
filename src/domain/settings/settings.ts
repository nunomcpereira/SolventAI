import { z } from "zod";
import { type DayCountConvention } from "../../engine/dayCount/dayCount.js";
import { type RoundingMode } from "../../engine/money/rounding.js";
import { type AccountType } from "../../domain/accounts/account.js";
import { DEFAULT_LOAN_CATEGORIES } from "../../domain/loans/loan.js";
import { INCOME_CATEGORIES } from "../../domain/income/income.js";
import { currencyCodeSchema, DomainValidationError } from "../shared/index.js";

export const SUPPORTED_LANGUAGES = ["en", "pt", "es", "de", "fr"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Singleton application settings (spec section 29/30). Persisted as a single row.
 * `allowCloudLlmFallback` defaults false and must be explicitly opted into by the
 * user — no cloud LLM fallback is ever silently enabled (spec section 21/27).
 */
export interface Settings {
  baseCurrency: string;
  roundingMode: RoundingMode;
  dayCountDefault: DayCountConvention;
  language: Language;
  accountTypeLabels: Record<AccountType, string>;
  loanCategoryLabels: Record<string, string>;
  customLoanCategories: string[];
  customIncomeCategories: string[];
  llmEndpoint: string;
  llmEnabled: boolean;
  allowCloudLlmFallback: boolean;
}

export interface SettingsRepository {
  get(): Promise<Settings | undefined>;
  save(settings: Settings): Promise<void>;
}

const roundingModeSchema = z.enum(["half-up", "half-even", "down", "up"]);
const dayCountConventionSchema = z.enum(["actual/360", "actual/365", "30/360"]);
const languageSchema = z.enum(SUPPORTED_LANGUAGES);
const accountTypeLabelSchema = z.object({
  checking: z.string().trim().min(1),
  savings: z.string().trim().min(1),
  emergency: z.string().trim().min(1),
  investment: z.string().trim().min(1),
  other: z.string().trim().min(1),
});
const loanCategoryLabelSchema = z.record(z.string().trim().min(1), z.string().trim().min(1));
const customCategoryListSchema = z.array(z.string().trim().min(1)).transform((items) => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
});

export const settingsInputSchema = z.object({
  baseCurrency: currencyCodeSchema,
  roundingMode: roundingModeSchema,
  dayCountDefault: dayCountConventionSchema,
  language: languageSchema,
  accountTypeLabels: accountTypeLabelSchema,
  loanCategoryLabels: loanCategoryLabelSchema,
  customLoanCategories: customCategoryListSchema,
  customIncomeCategories: customCategoryListSchema,
  llmEndpoint: z.string().url(),
  llmEnabled: z.boolean(),
  allowCloudLlmFallback: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: "EUR",
  roundingMode: "half-even",
  dayCountDefault: "actual/365",
  language: "en",
  accountTypeLabels: {
    checking: "Checking",
    savings: "Savings",
    emergency: "Emergency",
    investment: "Investment",
    other: "Other",
  },
  loanCategoryLabels: {
    mortgage: "Mortgage",
    auto: "Auto",
    personal: "Personal",
    consumer: "Consumer",
    student: "Student",
    other: "Other",
  },
  customLoanCategories: [],
  customIncomeCategories: [],
  llmEndpoint: "http://localhost:8050/v1",
  llmEnabled: false,
  allowCloudLlmFallback: false,
};

export function parseSettings(raw: unknown): Settings {
  const result = settingsInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("Settings", result.error);
  }
  const data = result.data;

  const mergedLabels: Record<string, string> = {
    ...DEFAULT_SETTINGS.loanCategoryLabels,
    ...data.loanCategoryLabels,
  };

  const customLoanCategories = customCategoryListSchema
    .parse(data.customLoanCategories)
    .filter((category) => !DEFAULT_LOAN_CATEGORIES.includes(category as (typeof DEFAULT_LOAN_CATEGORIES)[number]));

  for (const category of [...DEFAULT_LOAN_CATEGORIES, ...customLoanCategories]) {
    if (!mergedLabels[category]) {
      mergedLabels[category] = category;
    }
  }

  // Ensure built-in income categories are never dropped from the effective set.
  const customIncomeCategories = customCategoryListSchema.parse([
    ...INCOME_CATEGORIES,
    ...data.customIncomeCategories,
  ]).filter((category) => !INCOME_CATEGORIES.includes(category as (typeof INCOME_CATEGORIES)[number]));

  return {
    ...data,
    loanCategoryLabels: mergedLabels,
    customLoanCategories,
    customIncomeCategories,
  };
}

export function serializeSettings(settings: Settings): SettingsInput {
  return settings;
}
