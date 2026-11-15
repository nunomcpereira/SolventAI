import "server-only";
import { randomUUID } from "node:crypto";
import { parseRecurringTransfer, type RecurringTransfer } from "../../domain/transfers/recurringTransfer.js";
import { Money } from "../../engine/money/money.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { getDb } from "./db.js";
import { createSqliteAccountRepository, createSqliteRecurringTransferRepository } from "../db/repositories/index.js";

export interface RecurringTransferInput {
  fromAccountId: string;
  toAccountId: string;
  /** Decimal string in the source account's currency; "," is accepted as decimal separator. */
  amount: string;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  description?: string;
}

async function build(id: string, input: RecurringTransferInput): Promise<RecurringTransfer> {
  const db = await getDb();
  const from = await createSqliteAccountRepository(db).findById(input.fromAccountId);
  if (!from) throw new Error(`Unknown source account "${input.fromAccountId}"`);
  const amount = Money.fromDecimalString(input.amount.replace(/\s+/g, "").replace(",", ".") || "0", from.currency);
  return parseRecurringTransfer({
    id,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: { minorUnits: amount.minorUnits.toString(), currency: amount.currency },
    frequency: input.frequency,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
  });
}

export async function listRecurringTransfers(): Promise<RecurringTransfer[]> {
  return createSqliteRecurringTransferRepository(await getDb()).list();
}

export async function createRecurringTransfer(input: RecurringTransferInput): Promise<RecurringTransfer> {
  const transfer = await build(randomUUID(), input);
  await createSqliteRecurringTransferRepository(await getDb()).save(transfer);
  return transfer;
}

export async function updateRecurringTransfer(id: string, input: RecurringTransferInput): Promise<RecurringTransfer> {
  const transfer = await build(id, input);
  await createSqliteRecurringTransferRepository(await getDb()).save(transfer);
  return transfer;
}

export async function deleteRecurringTransfer(id: string): Promise<void> {
  await createSqliteRecurringTransferRepository(await getDb()).delete(id);
}
