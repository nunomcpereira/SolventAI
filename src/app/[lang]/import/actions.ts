"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  importStatement,
  applyProposals,
  dismissProposal,
  restoreProposal,
  deleteImport,
  BankImportError,
  type ProposalChoice,
} from "../../../lib/services/bankImportService.js";
import { emitChange } from "../../../lib/services/changeEvents.js";
import { type Frequency } from "../../../engine/dates/frequency.js";
import { type ProposalKind } from "../../../engine/bankImport/recurrence.js";

const KINDS: readonly ProposalKind[] = ["expense", "income", "transfer"];
const FREQUENCIES: readonly Frequency[] = ["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"];

function revalidateModel(lang: string): void {
  for (const page of ["import", "accounts", "loans", "dashboard", "simulation"]) revalidatePath(`/${lang}/${page}`);
  emitChange("accounts");
  emitChange("loans");
}

export async function importStatementAction(lang: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/${lang}/import?error=empty_file`);
  const accountId = String(formData.get("accountId") ?? "") || undefined;
  let target: string;
  try {
    const result = await importStatement({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      ...(accountId ? { accountId } : {}),
      updateBalance: formData.get("updateBalance") === "on",
    });
    target = `/${lang}/import?account=${encodeURIComponent(result.accountId)}&imported=${encodeURIComponent(result.importId)}${result.balanceUpdated ? "&balance=1" : ""}`;
  } catch (error) {
    if (!(error instanceof BankImportError)) throw error;
    target = `/${lang}/import?error=${error.code}`;
  }
  revalidateModel(lang);
  redirect(target);
}

function choicesFrom(formData: FormData): ProposalChoice[] {
  const picked = new Set(formData.getAll("pick").map(String));
  const choices: ProposalChoice[] = [];
  for (const index of picked) {
    const field = (name: string) => String(formData.get(`p${index}_${name}`) ?? "").trim();
    const kind = field("kind") as ProposalKind;
    const frequency = field("frequency") as Frequency;
    const key = field("key");
    if (!key || !KINDS.includes(kind) || !FREQUENCIES.includes(frequency)) continue;
    const toAccountId = field("toAccountId");
    const updateId = field("updateId");
    const description = field("description");
    choices.push({
      key,
      kind,
      amount: field("amount"),
      frequency,
      category: field("category") || "other",
      startDate: field("startDate"),
      ...(toAccountId ? { toAccountId } : {}),
      ...(updateId ? { updateId } : {}),
      ...(description ? { description } : {}),
    });
  }
  return choices;
}

export async function applyProposalsAction(lang: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;
  const applied = await applyProposals(accountId, choicesFrom(formData));
  revalidateModel(lang);
  redirect(`/${lang}/import?account=${encodeURIComponent(accountId)}&applied=${applied}`);
}

export async function dismissProposalAction(lang: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  const key = String(formData.get("dismissKey") ?? "");
  if (!accountId || !key) return;
  await dismissProposal(accountId, key);
  revalidatePath(`/${lang}/import`);
  redirect(`/${lang}/import?account=${encodeURIComponent(accountId)}`);
}

export async function restoreProposalAction(lang: string, formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  const key = String(formData.get("restoreKey") ?? "");
  if (!accountId || !key) return;
  await restoreProposal(accountId, key);
  revalidatePath(`/${lang}/import`);
  redirect(`/${lang}/import?account=${encodeURIComponent(accountId)}`);
}

export async function deleteImportAction(lang: string, formData: FormData): Promise<void> {
  const importId = String(formData.get("importId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  if (!importId) return;
  await deleteImport(importId);
  revalidatePath(`/${lang}/import`);
  redirect(`/${lang}/import${accountId ? `?account=${encodeURIComponent(accountId)}` : ""}`);
}
