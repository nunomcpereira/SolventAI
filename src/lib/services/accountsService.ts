import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import {
  createSqliteAccountRepository,
  createSqliteLoanRepository,
  createSqliteIncomeRepository,
  createSqliteExpenseRepository,
  createSqliteScenarioRepository,
} from "../db/repositories/index.js";
import { type Account, parseAccount, type AccountType } from "../../domain/accounts/account.js";
import { Money } from "../../engine/money/money.js";

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  await ensureSeeded(db);
  return createSqliteAccountRepository(db).list();
}

export interface AccountFormInput {
  name: string;
  type: AccountType;
  currency: string;
  balance: string;
  minimumReserve: string;
  active: boolean;
}

export async function createAccount(input: AccountFormInput): Promise<Account> {
  const account = parseAccount({
    id: randomUUID(),
    name: input.name,
    type: input.type,
    currency: input.currency,
    initialBalance: { minorUnits: toMinorUnits(input.balance, input.currency), currency: input.currency },
    minimumReserve: { minorUnits: toMinorUnits(input.minimumReserve, input.currency), currency: input.currency },
    active: input.active,
    isDefault: false,
  });
  const db = await getDb();
  await createSqliteAccountRepository(db).save(account);
  return account;
}

/** Marks `id` as the one default account, clearing the flag on every other account. */
export async function setDefaultAccount(id: string): Promise<void> {
  const db = await getDb();
  const repo = createSqliteAccountRepository(db);
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Account "${id}" not found`);
  await repo.setDefault(id);
}

/** Updates an account's balance/reserve/status. Name/type/currency are not editable here (keeps the update path narrow and unambiguous — renaming/re-typing an account is a separate concern from correcting its balance). */
export async function updateAccountBalance(
  id: string,
  input: { balance: string; minimumReserve: string; active: boolean },
): Promise<Account> {
  const db = await getDb();
  const repo = createSqliteAccountRepository(db);
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Account "${id}" not found`);

  const updated = parseAccount({
    id: existing.id,
    name: existing.name,
    type: existing.type,
    currency: existing.currency,
    initialBalance: { minorUnits: toMinorUnits(input.balance, existing.currency), currency: existing.currency },
    minimumReserve: { minorUnits: toMinorUnits(input.minimumReserve, existing.currency), currency: existing.currency },
    active: input.active,
    isDefault: existing.isDefault,
  });
  await repo.save(updated);
  return updated;
}

export async function renameAccount(id: string, name: string): Promise<Account> {
  const db = await getDb();
  const repo = createSqliteAccountRepository(db);
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Account "${id}" not found`);

  const updated = parseAccount({
    id: existing.id,
    name,
    type: existing.type,
    currency: existing.currency,
    initialBalance: {
      minorUnits: existing.initialBalance.minorUnits.toString(),
      currency: existing.currency,
    },
    minimumReserve: {
      minorUnits: existing.minimumReserve.minorUnits.toString(),
      currency: existing.currency,
    },
    active: existing.active,
    isDefault: existing.isDefault,
  });

  await repo.save(updated);
  return updated;
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  const accountRepo = createSqliteAccountRepository(db);
  const loanRepo = createSqliteLoanRepository(db);
  const incomeRepo = createSqliteIncomeRepository(db);
  const expenseRepo = createSqliteExpenseRepository(db);
  const scenarioRepo = createSqliteScenarioRepository(db);

  const [loans, incomes, expenses, scenarios] = await Promise.all([
    loanRepo.list(),
    incomeRepo.list(),
    expenseRepo.list(),
    scenarioRepo.list(),
  ]);

  await Promise.all([
    ...loans.filter((loan) => loan.sourceAccountId === id).map((loan) => loanRepo.delete(loan.id)),
    ...incomes.filter((income) => income.accountId === id).map((income) => incomeRepo.delete(income.id)),
    ...expenses.filter((expense) => expense.accountId === id).map((expense) => expenseRepo.delete(expense.id)),
  ]);

  await Promise.all(
    scenarios.map(async (scenario) => {
      const filteredEvents = scenario.events.filter((event) => {
        switch (event.payload.type) {
          case "balance_override":
          case "one_time_income":
          case "one_time_expense":
            return event.payload.accountId !== id;
          case "account_transfer":
            return event.payload.fromAccountId !== id && event.payload.toAccountId !== id;
          case "prepayment":
            return event.payload.sourceAccountId !== id;
          default:
            return true;
        }
      });

      if (filteredEvents.length !== scenario.events.length) {
        await scenarioRepo.save({ ...scenario, events: filteredEvents });
      }
    }),
  );

  await accountRepo.delete(id);
}

function toMinorUnits(decimalAmount: string, currency: string): string {
  return Money.fromDecimalString(decimalAmount || "0", currency).minorUnits.toString();
}
