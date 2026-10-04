import { type Frequency } from "../../engine/dates/frequency.js";

export interface ParsedRecurringEntryCreate {
  accountId: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  category: string;
}

export interface ParsedRecurringEntryUpdate {
  accountId: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  category: string;
}

/** Shared shape behind both the income and expense "new recurring/one-off entry" forms. */
export function parseRecurringEntryCreate(formData: FormData, currency: string): ParsedRecurringEntryCreate {
  const startDate = String(formData.get("startDate") ?? new Date().toISOString().slice(0, 10));
  const entryType = String(formData.get("entryType") ?? "recurring");
  return {
    accountId: String(formData.get("accountId") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    currency,
    frequency: String(formData.get("frequency") ?? "monthly") as Frequency,
    startDate,
    ...(entryType === "one_off" ? { endDate: startDate } : {}),
    category: String(formData.get("category") ?? "other"),
  };
}

export function parseRecurringEntryUpdate(formData: FormData, currency: string): ParsedRecurringEntryUpdate {
  const endDate = String(formData.get("endDate") ?? "");
  return {
    accountId: String(formData.get("accountId") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    currency,
    frequency: String(formData.get("frequency") ?? "monthly") as Frequency,
    startDate: String(formData.get("startDate") ?? ""),
    ...(endDate ? { endDate } : {}),
    category: String(formData.get("category") ?? "other"),
  };
}
