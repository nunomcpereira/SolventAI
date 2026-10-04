"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveSettings } from "../../../lib/services/settingsService.js";

function parseTypeList(values: FormDataEntryValue[]): string[] {
  if (values.length === 0) return [];

  return values
    .flatMap((value) => String(value ?? "").split(/\r?\n|,/))
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function saveSettingsAction(lang: string, formData: FormData): Promise<void> {
  const settings = await saveSettings({
    baseCurrency: String(formData.get("baseCurrency")),
    roundingMode: String(formData.get("roundingMode")),
    dayCountDefault: String(formData.get("dayCountDefault")),
    language: String(formData.get("language")),
    accountTypeLabels: {
      checking: String(formData.get("accountTypeLabel_checking") ?? "Checking"),
      savings: String(formData.get("accountTypeLabel_savings") ?? "Savings"),
      emergency: String(formData.get("accountTypeLabel_emergency") ?? "Emergency"),
      investment: String(formData.get("accountTypeLabel_investment") ?? "Investment"),
      other: String(formData.get("accountTypeLabel_other") ?? "Other"),
    },
    loanCategoryLabels: {
      mortgage: String(formData.get("loanCategoryLabel_mortgage") ?? "Mortgage"),
      auto: String(formData.get("loanCategoryLabel_auto") ?? "Auto"),
      personal: String(formData.get("loanCategoryLabel_personal") ?? "Personal"),
      consumer: String(formData.get("loanCategoryLabel_consumer") ?? "Consumer"),
      student: String(formData.get("loanCategoryLabel_student") ?? "Student"),
      other: String(formData.get("loanCategoryLabel_other") ?? "Other"),
    },
    customLoanCategories: parseTypeList(formData.getAll("customLoanCategories")),
    customIncomeCategories: parseTypeList(formData.getAll("customIncomeCategories")),
    llmEndpoint: String(formData.get("llmEndpoint")),
    llmEnabled: formData.get("llmEnabled") === "on",
    allowCloudLlmFallback: formData.get("allowCloudLlmFallback") === "on",
  });

  revalidatePath(`/${lang}/settings`);

  // If the user changed the language, navigate them to that language's settings
  // page so the change is immediately visible rather than silently taking effect
  // only on the next manual navigation.
  if (settings.language !== lang) {
    redirect(`/${settings.language}/settings`);
  }
}
