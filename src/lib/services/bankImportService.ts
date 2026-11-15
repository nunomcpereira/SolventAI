import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { appNow, appTodayIso, getDb } from "./db.js";
import {
  createSqliteAccountRepository,
  createSqliteBankImportRepository,
  createSqliteExpenseRepository,
  createSqliteIncomeRepository,
  createSqliteLoanRepository,
  createSqliteRecurringTransferRepository,
} from "../db/repositories/index.js";
import { type BankImportRecord, type BankTransactionRecord } from "../db/repositories/sqliteBankImportRepository.js";
import { type Account } from "../../domain/accounts/account.js";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../../domain/expenses/expense.js";
import { Money } from "../../engine/money/money.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { decodeStatementBytes, StatementParseError, type ParsedStatement } from "../../engine/bankImport/statement.js";
import { parseStatement } from "../../engine/bankImport/parseStatement.js";
import { detectRecurring, type Proposal, type ProposalKind } from "../../engine/bankImport/recurrence.js";
import { getLoanSchedule, periodsElapsedBefore, MissingRateDataError } from "./loanService.js";
import { createRecurringExpense, createRecurringIncome, updateRecurringExpense, updateRecurringIncome } from "./recurringItemsService.js";
import { createRecurringTransfer, updateRecurringTransfer } from "./recurringTransfersService.js";

export type ImportErrorCode = "unknown_format" | "no_rows" | "bad_row" | "no_account" | "currency_mismatch" | "empty_file";

export class BankImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BankImportError";
  }
}

export interface ImportResult {
  importId: string;
  accountId: string;
  rowCount: number;
  newRowCount: number;
  periodStart?: string;
  periodEnd?: string;
  closingBalance?: Money;
  balanceUpdated: boolean;
  balanceCheck: { checked: number; mismatches: number };
}

/**
 * Stable id for a movement, so re-importing an overlapping statement skips what's
 * already stored. The running balance makes otherwise identical same-day movements
 * distinct; `occurrence` separates exact duplicates within one file when there is none.
 */
export function transactionId(accountId: string, row: ParsedStatement["rows"][number], occurrence: number): string {
  const parts = [
    accountId,
    row.bookingDate.toString(),
    row.valueDate.toString(),
    row.description,
    row.amount.minorUnits.toString(),
    row.balanceAfter?.minorUnits.toString() ?? "",
    String(occurrence),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** Which account a statement belongs to: the one chosen, else the one this bank account
 * number was imported into before, else the default account. */
async function resolveAccount(statement: ParsedStatement, accountId: string | undefined): Promise<Account> {
  const db = await getDb();
  const accounts = await createSqliteAccountRepository(db).list();
  const linked = statement.externalAccountRef ? createSqliteBankImportRepository(db).accountForExternalRef(statement.externalAccountRef) : undefined;
  const account =
    accounts.find((a) => a.id === accountId) ??
    accounts.find((a) => a.id === linked) ??
    accounts.find((a) => a.isDefault) ??
    accounts[0];
  if (!account) throw new BankImportError("no_account", "Add an account before importing a statement");
  return account;
}

/** The account a statement file would go to by default (for pre-selecting it in the form). */
export async function suggestedAccountForRef(ref: string): Promise<string | undefined> {
  return createSqliteBankImportRepository(await getDb()).accountForExternalRef(ref);
}

export async function importStatement(input: {
  fileName: string;
  bytes: Uint8Array;
  accountId?: string;
  /** Set the account's balance to the statement's closing balance (only when it's the newest statement). */
  updateBalance: boolean;
}): Promise<ImportResult> {
  if (input.bytes.length === 0) throw new BankImportError("empty_file", "The file is empty");
  let statement: ParsedStatement;
  try {
    statement = parseStatement(decodeStatementBytes(input.bytes));
  } catch (error) {
    if (error instanceof StatementParseError) throw new BankImportError(error.code, error.message);
    throw error;
  }

  const account = await resolveAccount(statement, input.accountId);
  if (statement.currency !== account.currency) {
    throw new BankImportError("currency_mismatch", `Statement is in ${statement.currency}, account "${account.name}" is in ${account.currency}`);
  }

  const db = await getDb();
  const repo = createSqliteBankImportRepository(db);
  const previousLatestEnd = repo
    .listImports(account.id)
    .map((i) => i.periodEnd ?? "")
    .sort()
    .pop();

  const importId = randomUUID();
  const seen = new Map<string, number>();
  const transactions: BankTransactionRecord[] = statement.rows.map((row) => {
    const base = transactionId(account.id, row, 0);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return {
      id: occurrence === 0 ? base : transactionId(account.id, row, occurrence),
      accountId: account.id,
      importId,
      bookingDate: row.bookingDate.toString(),
      valueDate: row.valueDate.toString(),
      description: row.description,
      amountMinorUnits: row.amount.minorUnits.toString(),
      currency: row.amount.currency,
      ...(row.balanceAfter ? { balanceAfterMinorUnits: row.balanceAfter.minorUnits.toString() } : {}),
      ...(row.bankCategory ? { bankCategory: row.bankCategory } : {}),
    };
  });

  const periodStart = statement.periodStart?.toString();
  const periodEnd = statement.periodEnd?.toString();
  const newRowCount = repo.saveImport(
    {
      id: importId,
      accountId: account.id,
      bank: statement.bank,
      fileName: input.fileName,
      importedAt: (await appNow()).toISOString(),
      ...(statement.externalAccountRef ? { externalAccountRef: statement.externalAccountRef } : {}),
      ...(periodStart ? { periodStart } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      ...(statement.closingBalance ? { closingBalanceMinorUnits: statement.closingBalance.minorUnits.toString() } : {}),
      currency: statement.currency,
      rowCount: statement.rows.length,
      balanceCheckOk: statement.balanceCheck.mismatches === 0,
    },
    transactions,
  );

  // An older statement imported after a newer one must not roll the balance back.
  const isNewest = previousLatestEnd === undefined || (periodEnd ?? "") >= previousLatestEnd;
  let balanceUpdated = false;
  if (input.updateBalance && statement.closingBalance && isNewest && !statement.closingBalance.equals(account.initialBalance)) {
    await createSqliteAccountRepository(db).save({ ...account, initialBalance: statement.closingBalance });
    balanceUpdated = true;
  }

  return {
    importId,
    accountId: account.id,
    rowCount: statement.rows.length,
    newRowCount,
    ...(periodStart ? { periodStart } : {}),
    ...(periodEnd ? { periodEnd } : {}),
    ...(statement.closingBalance ? { closingBalance: statement.closingBalance } : {}),
    balanceUpdated,
    balanceCheck: statement.balanceCheck,
  };
}

export async function listImports(): Promise<BankImportRecord[]> {
  return createSqliteBankImportRepository(await getDb()).listImports();
}

export async function getImport(id: string): Promise<BankImportRecord | undefined> {
  return createSqliteBankImportRepository(await getDb()).findImport(id);
}

export async function deleteImport(id: string): Promise<void> {
  createSqliteBankImportRepository(await getDb()).deleteImport(id);
}

export interface ExistingItemSummary {
  id: string;
  kind: "expense" | "income" | "transfer";
  category: string;
  amount: Money;
  frequency: Frequency;
}

export interface ProposalsView {
  accountId: string;
  asOf?: string;
  historyStart?: string;
  transactionCount: number;
  proposals: Proposal[];
  dismissed: Proposal[];
  acceptedCount: number;
  /** Names of the loans proposals may refer to (status covered_by_loan). */
  loanNames: Record<string, string>;
  /** Items already on this account that no proposal accounts for — e.g. a lump-sum
   * estimate that the detailed proposals would double-count. */
  unmatchedExisting: ExistingItemSummary[];
}

/** Runs recurrence detection over every movement imported for `accountId`. */
export async function getProposals(accountId: string): Promise<ProposalsView> {
  const db = await getDb();
  const repo = createSqliteBankImportRepository(db);
  const [accounts, loans, expenses, incomes, transfers] = await Promise.all([
    createSqliteAccountRepository(db).list(),
    createSqliteLoanRepository(db).list(),
    createSqliteExpenseRepository(db).list(),
    createSqliteIncomeRepository(db).list(),
    createSqliteRecurringTransferRepository(db).list(),
  ]);
  const account = accounts.find((a) => a.id === accountId);
  const records = repo.listTransactions(accountId);
  const imports = repo.listImports(accountId);
  const loanNames = Object.fromEntries(loans.map((l) => [l.id, l.name]));
  const empty: ProposalsView = { accountId, transactionCount: 0, proposals: [], dismissed: [], acceptedCount: 0, loanNames, unmatchedExisting: [] };
  if (!account || records.length === 0) return empty;

  const asOf = imports.map((i) => i.periodEnd ?? "").filter(Boolean).sort().pop() ?? records[records.length - 1]!.bookingDate;
  const historyStart = imports.map((i) => i.periodStart ?? "").filter(Boolean).sort()[0] ?? records[0]!.bookingDate;
  const today = IsoDate.fromString(await appTodayIso());

  const loanPayments = [];
  for (const loan of loans.filter((l) => l.sourceAccountId === accountId)) {
    try {
      const entry = getLoanSchedule(loan)[periodsElapsedBefore(loan, today)];
      if (entry) loanPayments.push({ loanId: loan.id, name: loan.name, amount: entry.totalCashOutflow });
    } catch (error) {
      if (!(error instanceof MissingRateDataError)) throw error;
    }
  }

  const accountExpenses = expenses.filter((e) => e.accountId === accountId);
  const accountIncomes = incomes.filter((i) => i.accountId === accountId);
  const accountTransfers = transfers.filter((t) => t.fromAccountId === accountId);

  const all = detectRecurring({
    accountId,
    currency: account.currency,
    transactions: records.map((r) => ({
      id: r.id,
      date: IsoDate.fromString(r.bookingDate),
      description: r.description,
      amount: Money.fromMinorUnits(BigInt(r.amountMinorUnits), r.currency),
      ...(r.bankCategory ? { bankCategory: r.bankCategory } : {}),
    })),
    asOf: IsoDate.fromString(asOf),
    historyStart: IsoDate.fromString(historyStart),
    otherAccounts: accounts.filter((a) => a.id !== accountId).map((a) => ({ id: a.id, name: a.name, type: a.type })),
    loanPayments,
    existingItems: [
      ...accountExpenses.map((e) => ({ id: e.id, kind: "expense" as const, category: e.category, amount: e.amount, frequency: e.frequency })),
      ...accountIncomes.map((i) => ({ id: i.id, kind: "income" as const, category: i.category, amount: i.amount, frequency: i.frequency })),
    ],
    existingTransfers: accountTransfers.map((t) => ({ id: t.id, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId, amount: t.amount, frequency: t.frequency })),
  });

  const decisions = repo.listDecisions(accountId);
  const matched = new Set(all.map((p) => p.matchId).filter((id): id is string => id !== undefined));
  // An item created from an accepted proposal also counts as accounted for.
  const createdFromProposals = new Set([...decisions.keys()].filter((k) => k.startsWith("item:")).map((k) => k.slice("item:".length)));
  const accepted = all.filter((p) => decisions.get(p.key) === "accepted");
  const unmatchedExisting: ExistingItemSummary[] = [
    ...accountExpenses.map((e) => ({ id: e.id, kind: "expense" as const, category: e.category, amount: e.amount, frequency: e.frequency })),
    ...accountIncomes.map((i) => ({ id: i.id, kind: "income" as const, category: i.category, amount: i.amount, frequency: i.frequency })),
  ].filter((item) => !matched.has(item.id) && !createdFromProposals.has(item.id));

  return {
    accountId,
    asOf,
    historyStart,
    transactionCount: records.length,
    proposals: all.filter((p) => !decisions.has(p.key)),
    dismissed: all.filter((p) => decisions.get(p.key) === "dismissed"),
    acceptedCount: accepted.length,
    loanNames,
    unmatchedExisting,
  };
}

export interface ProposalChoice {
  key: string;
  kind: ProposalKind;
  /** Decimal string in the account's currency. */
  amount: string;
  frequency: Frequency;
  category: string;
  startDate: string;
  /** Required for transfers. */
  toAccountId?: string;
  /** Update this existing item instead of creating a new one. */
  updateId?: string;
  description?: string;
}

/** Creates (or updates) the chosen items and remembers the proposals as accepted. */
export async function applyProposals(accountId: string, choices: readonly ProposalChoice[]): Promise<number> {
  const db = await getDb();
  const repo = createSqliteBankImportRepository(db);
  const account = await createSqliteAccountRepository(db).findById(accountId);
  if (!account) throw new BankImportError("no_account", `Account "${accountId}" not found`);
  const now = (await appNow()).toISOString();
  let applied = 0;

  for (const choice of choices) {
    const common = { amount: choice.amount, frequency: choice.frequency, startDate: choice.startDate };
    let itemId: string | undefined;
    if (choice.kind === "transfer") {
      if (!choice.toAccountId || choice.toAccountId === accountId) continue;
      const input = { ...common, fromAccountId: accountId, toAccountId: choice.toAccountId, ...(choice.description ? { description: choice.description } : {}) };
      itemId = choice.updateId
        ? (await updateRecurringTransfer(choice.updateId, await keepTransferFields(choice.updateId, input))).id
        : (await createRecurringTransfer(input)).id;
    } else if (choice.kind === "expense") {
      const category = (EXPENSE_CATEGORIES as readonly string[]).includes(choice.category) ? (choice.category as ExpenseCategory) : "other";
      if (choice.updateId) {
        const existing = await createSqliteExpenseRepository(db).findById(choice.updateId);
        if (!existing) continue;
        itemId = (
          await updateRecurringExpense(existing.id, {
            accountId,
            amount: choice.amount,
            currency: account.currency,
            frequency: existing.frequency,
            startDate: existing.startDate.toString(),
            ...(existing.endDate ? { endDate: existing.endDate.toString() } : {}),
            category: existing.category,
          })
        ).id;
      } else {
        itemId = (await createRecurringExpense({ ...common, accountId, currency: account.currency, category })).id;
      }
    } else {
      if (choice.updateId) {
        const existing = await createSqliteIncomeRepository(db).findById(choice.updateId);
        if (!existing) continue;
        itemId = (
          await updateRecurringIncome(existing.id, {
            accountId,
            amount: choice.amount,
            currency: account.currency,
            frequency: existing.frequency,
            startDate: existing.startDate.toString(),
            ...(existing.endDate ? { endDate: existing.endDate.toString() } : {}),
            category: existing.category,
          })
        ).id;
      } else {
        itemId = (await createRecurringIncome({ ...common, accountId, currency: account.currency, category: choice.category || "other" })).id;
      }
    }
    repo.setDecision(accountId, choice.key, "accepted", now);
    // Remembered so the item isn't later listed as "not accounted for by any proposal".
    repo.setDecision(accountId, `item:${itemId}`, "accepted", now);
    applied++;
  }
  return applied;
}

/** Updating an existing transfer from a proposal changes its amount only. */
async function keepTransferFields(
  id: string,
  input: { amount: string; fromAccountId: string; toAccountId: string; frequency: Frequency; startDate: string; description?: string },
) {
  const existing = await createSqliteRecurringTransferRepository(await getDb()).findById(id);
  if (!existing) return input;
  return {
    ...input,
    toAccountId: existing.toAccountId,
    frequency: existing.frequency,
    startDate: existing.startDate.toString(),
    ...(existing.endDate ? { endDate: existing.endDate.toString() } : {}),
    ...(existing.description ? { description: existing.description } : {}),
  };
}

export async function dismissProposal(accountId: string, key: string): Promise<void> {
  createSqliteBankImportRepository(await getDb()).setDecision(accountId, key, "dismissed", (await appNow()).toISOString());
}

export async function restoreProposal(accountId: string, key: string): Promise<void> {
  createSqliteBankImportRepository(await getDb()).clearDecision(accountId, key);
}
