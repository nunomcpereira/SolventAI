"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLoan, updateLoan, deleteLoan } from "../../../lib/services/loansPageService.js";
import { uploadContract } from "../../../lib/services/contractsService.js";
import { type LoanCategory } from "../../../domain/loans/loan.js";
import { type ExpenseCategory } from "../../../domain/expenses/expense.js";
import { type Frequency } from "../../../engine/dates/frequency.js";
import { type AmortizationType } from "../../../engine/amortization/amortization.js";
import { listAccounts } from "../../../lib/services/accountsService.js";
import { createRecurringExpense, updateRecurringExpense, deleteRecurringExpense } from "../../../lib/services/recurringItemsService.js";
import { emitChange } from "../../../lib/services/changeEvents.js";
import { parseRecurringEntryCreate, parseRecurringEntryUpdate } from "../../../lib/forms/recurringEntryForm.js";
import { parseLoanFormCreate, buildLoanDraftFromExtraction, type LoanContractDraftState } from "../../../lib/forms/loanForm.js";

export type { LoanContractDraftState };

export async function createLoanAction(lang: string, formData: FormData): Promise<void> {
  await createLoan(parseLoanFormCreate(formData));

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
}

export async function updateLoanAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("loanId") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "");
  const category = String(formData.get("category") ?? "personal") as LoanCategory;
  const principalAmount = String(formData.get("principalAmount") ?? "0");
  const currency = String(formData.get("currency") ?? "EUR");
  const startDate = String(formData.get("startDate") ?? "");
  const numberOfPeriods = Number(formData.get("numberOfPeriods") ?? 12);
  const paymentFrequency = String(formData.get("paymentFrequency") ?? "monthly") as Frequency;
  const amortizationType = String(formData.get("amortizationType") ?? "french") as AmortizationType;
  const rateType = String(formData.get("rateType") ?? "") as "fixed" | "variable" | "mixed" | "";
  const fixedRate = String(formData.get("fixedRate") ?? "");
  const euriborRate = String(formData.get("euriborRate") ?? "");
  const spread = String(formData.get("spread") ?? "");
  const fixedRatePeriods = Number(formData.get("fixedRatePeriods") ?? "");
  const sourceAccountId = String(formData.get("sourceAccountId") ?? "");
  const contractDocumentId = String(formData.get("contractDocumentId") ?? "");

  await updateLoan(id, {
    ...(name ? { name } : {}),
    category,
    principalAmount,
    currency,
    ...(startDate ? { startDate } : {}),
    numberOfPeriods,
    paymentFrequency,
    amortizationType,
    ...(rateType ? { rateType } : {}),
    ...(fixedRate ? { fixedRate } : {}),
    ...(euriborRate ? { euriborRate } : {}),
    ...(spread ? { spread } : {}),
    ...(Number.isFinite(fixedRatePeriods) ? { fixedRatePeriods } : {}),
    sourceAccountId,
    contractDocumentId,
  });

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
}

export async function deleteLoanAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("loanId") ?? "");
  if (!id) return;

  await deleteLoan(id);

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
}

export async function createLoanFromContractAction(lang: string, formData: FormData): Promise<void> {
  await createLoan(parseLoanFormCreate(formData, "Extracted Contract Loan"));

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/upload`);
  emitChange("upload");
  revalidatePath(`/${lang}/dashboard`);
  redirect(`/${lang}/loans`);
}

export async function uploadLoanContractAction(lang: string, formData: FormData): Promise<void> {
  const loanId = String(formData.get("loanId") ?? "").trim();
  const file = formData.get("file");
  if (!loanId || !(file instanceof File) || file.size === 0) {
    return;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { document } = await uploadContract(file.name, bytes);

  await updateLoan(loanId, { contractDocumentId: document.id });

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/upload`);
  emitChange("upload");
}

export async function extractLoanDraftFromContractAction(
  _lang: string,
  _prevState: LoanContractDraftState,
  formData: FormData,
): Promise<LoanContractDraftState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please upload a contract PDF first." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadContract(file.name, bytes);

  return buildLoanDraftFromExtraction(result, {
    missingFile: "Please upload a contract PDF first.",
    extractionFailed: "Could not extract fields from this contract.",
    extractionSuccess: "Contract parsed. Review and confirm extracted loan details.",
  });
}

export async function createRecurringExpenseAction(lang: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  const account = (await listAccounts()).find((item) => item.id === accountId);
  if (!account) return;

  await createRecurringExpense({
    ...parseRecurringEntryCreate(formData, account.currency),
    category: String(formData.get("category") ?? "other") as ExpenseCategory,
  });

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/simulation`);
}

export async function updateRecurringExpenseAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("expenseId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  if (!id || !accountId) return;

  const account = (await listAccounts()).find((item) => item.id === accountId);
  if (!account) return;

  await updateRecurringExpense(id, {
    ...parseRecurringEntryUpdate(formData, account.currency),
    category: String(formData.get("category") ?? "other") as ExpenseCategory,
  });

  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/simulation`);
}

export async function deleteRecurringExpenseAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("expenseId") ?? "");
  if (!id) return;
  await deleteRecurringExpense(id);
  revalidatePath(`/${lang}/loans`);
  emitChange("loans");
  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/simulation`);
}
