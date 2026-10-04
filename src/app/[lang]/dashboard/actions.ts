"use server";

import { revalidatePath } from "next/cache";
import { createAccount } from "../../../lib/services/accountsService.js";
import { createLoan } from "../../../lib/services/loansPageService.js";
import { createScenario } from "../../../lib/services/scenarioService.js";
import { uploadContract } from "../../../lib/services/contractsService.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import { type Language } from "../../../domain/settings/settings.js";
import { parseAccountFormCreate } from "../../../lib/forms/accountForm.js";
import { parseLoanFormCreate, buildLoanDraftFromExtraction, type LoanContractDraftState } from "../../../lib/forms/loanForm.js";

export type { LoanContractDraftState };

export async function createDashboardAccountAction(lang: string, formData: FormData): Promise<void> {
  await createAccount(parseAccountFormCreate(formData));

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/accounts`);
}

export async function createDashboardLoanAction(lang: string, formData: FormData): Promise<void> {
  await createLoan(parseLoanFormCreate(formData));

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/loans`);
}

export async function createDashboardScenarioAction(lang: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await createScenario(name);

  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/simulation`);
}

export async function extractDashboardLoanFromContractAction(
  lang: string,
  _prevState: LoanContractDraftState,
  formData: FormData,
): Promise<LoanContractDraftState> {
  const dict = getDictionary(lang as Language);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: dict.wizards.extractionMissingFile };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadContract(file.name, bytes);

  return buildLoanDraftFromExtraction(result, {
    missingFile: dict.wizards.extractionMissingFile,
    extractionFailed: dict.wizards.extractionFailed,
    extractionSuccess: dict.wizards.extractionSuccess,
  });
}
