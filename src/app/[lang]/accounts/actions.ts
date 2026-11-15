"use server";

import { revalidatePath } from "next/cache";
import { createAccount, listAccounts, updateAccountBalance, deleteAccount, renameAccount, setDefaultAccount } from "../../../lib/services/accountsService.js";
import { type IncomeCategory } from "../../../domain/income/income.js";
import { createRecurringIncome, updateRecurringIncome, deleteRecurringIncome } from "../../../lib/services/recurringItemsService.js";
import { emitChange } from "../../../lib/services/changeEvents.js";
import { parseRecurringEntryCreate, parseRecurringEntryUpdate } from "../../../lib/forms/recurringEntryForm.js";
import { parseAccountFormCreate } from "../../../lib/forms/accountForm.js";
import {
  createRecurringTransfer,
  updateRecurringTransfer,
  deleteRecurringTransfer,
  type RecurringTransferInput,
} from "../../../lib/services/recurringTransfersService.js";
import { type Frequency } from "../../../engine/dates/frequency.js";

function revalidateAccountDependents(lang: string): void {
  revalidatePath(`/${lang}/accounts`);
  revalidatePath(`/${lang}/dashboard`);
  revalidatePath(`/${lang}/loans`);
  revalidatePath(`/${lang}/simulation`);
  emitChange("accounts");
}

export async function createAccountAction(lang: string, formData: FormData): Promise<void> {
  await createAccount(parseAccountFormCreate(formData));
  revalidateAccountDependents(lang);
}

/** Updating an account's balance re-bases every downstream projection (dashboard,
 * loans, simulation) off the new figure — those pages re-fetch live via `emitChange`
 * the same way a scenario "balance_override" event would, just for the real account. */
export async function updateAccountAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  if (!id) return;
  await updateAccountBalance(id, {
    balance: String(formData.get("balance") ?? "0"),
    minimumReserve: String(formData.get("minimumReserve") ?? "0"),
    active: formData.get("active") === "on",
  });
  revalidateAccountDependents(lang);
}

export async function renameAccountAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  if (!id) return;
  await renameAccount(id, String(formData.get("name") ?? ""));
  revalidateAccountDependents(lang);
}

export async function setDefaultAccountAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  if (!id) return;
  await setDefaultAccount(id);
  revalidateAccountDependents(lang);
  revalidatePath(`/${lang}/upload`);
}

export async function deleteAccountAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("accountId") ?? "");
  if (!id) return;
  await deleteAccount(id);
  revalidateAccountDependents(lang);
}

export async function createRecurringIncomeAction(lang: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;

  const account = (await listAccounts()).find((item) => item.id === accountId);
  if (!account) return;

  await createRecurringIncome({
    ...parseRecurringEntryCreate(formData, account.currency),
    category: String(formData.get("category") ?? "other") as IncomeCategory,
  });

  revalidateAccountDependents(lang);
}

export async function updateRecurringIncomeAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("incomeId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  if (!id || !accountId) return;

  const account = (await listAccounts()).find((item) => item.id === accountId);
  if (!account) return;

  await updateRecurringIncome(id, {
    ...parseRecurringEntryUpdate(formData, account.currency),
    category: String(formData.get("category") ?? "other") as IncomeCategory,
  });

  revalidateAccountDependents(lang);
}

export async function deleteRecurringIncomeAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("incomeId") ?? "");
  if (!id) return;
  await deleteRecurringIncome(id);
  revalidateAccountDependents(lang);
}

function transferInputFrom(formData: FormData): RecurringTransferInput | undefined {
  const fromAccountId = String(formData.get("fromAccountId") ?? "");
  const toAccountId = String(formData.get("toAccountId") ?? "");
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return undefined;
  const endDate = String(formData.get("endDate") ?? "");
  const description = String(formData.get("description") ?? "");
  return {
    fromAccountId,
    toAccountId,
    amount: String(formData.get("amount") ?? "0"),
    frequency: String(formData.get("frequency") ?? "monthly") as Frequency,
    startDate: String(formData.get("startDate") ?? new Date().toISOString().slice(0, 10)),
    ...(endDate ? { endDate } : {}),
    ...(description ? { description } : {}),
  };
}

export async function createRecurringTransferAction(lang: string, formData: FormData): Promise<void> {
  const input = transferInputFrom(formData);
  if (!input) return;
  await createRecurringTransfer(input);
  revalidateAccountDependents(lang);
}

export async function updateRecurringTransferAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("transferId") ?? "");
  const input = transferInputFrom(formData);
  if (!id || !input) return;
  await updateRecurringTransfer(id, input);
  revalidateAccountDependents(lang);
}

export async function deleteRecurringTransferAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("transferId") ?? "");
  if (!id) return;
  await deleteRecurringTransfer(id);
  revalidateAccountDependents(lang);
}
