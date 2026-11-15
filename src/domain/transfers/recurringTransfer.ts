import { z } from "zod";
import { type Money } from "../../engine/money/money.js";
import { type IsoDate } from "../../engine/dates/isoDate.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import {
  moneySchema,
  moneyToSerialized,
  moneyFromSerialized,
  isoDateSchema,
  isoDateToSerialized,
  isoDateFromSerialized,
  DomainValidationError,
  type Repository,
  type SerializedMoney,
  type SerializedIsoDate,
} from "../shared/index.js";

/**
 * A standing order moving money between two of the user's own accounts (e.g. a monthly
 * top-up from checking into savings). Unlike an expense it never leaves the household:
 * total liquidity is unchanged, only where the money sits. `amount` is debited from
 * `fromAccountId` in its own currency; the credited side receives the same value
 * converted to the destination's currency at simulation time.
 */
export interface RecurringTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  frequency: Frequency;
  startDate: IsoDate;
  endDate?: IsoDate;
  description?: string;
}

export interface SerializedRecurringTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: SerializedMoney;
  frequency: Frequency;
  startDate: SerializedIsoDate;
  endDate?: SerializedIsoDate;
  description?: string;
}

export interface RecurringTransferRepository extends Repository<RecurringTransfer> {}

export const recurringTransferInputSchema = z.object({
  id: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: moneySchema,
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"]),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  description: z.string().trim().max(200).optional(),
});

function invalid(path: string, message: string): DomainValidationError {
  return new DomainValidationError("RecurringTransfer", new z.ZodError([{ code: "custom", path: [path], message }]));
}

export function parseRecurringTransfer(raw: unknown): RecurringTransfer {
  const result = recurringTransferInputSchema.safeParse(raw);
  if (!result.success) throw new DomainValidationError("RecurringTransfer", result.error);
  const input = result.data;
  if (input.fromAccountId === input.toAccountId) throw invalid("toAccountId", "must differ from fromAccountId");
  const transfer: RecurringTransfer = {
    id: input.id,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: moneyFromSerialized(input.amount),
    frequency: input.frequency,
    startDate: isoDateFromSerialized(input.startDate),
    ...(input.endDate !== undefined ? { endDate: isoDateFromSerialized(input.endDate) } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
  if (!transfer.amount.isPositive()) throw invalid("amount", "must be positive");
  if (transfer.endDate?.isBefore(transfer.startDate)) throw invalid("endDate", "must not be before startDate");
  return transfer;
}

export function serializeRecurringTransfer(transfer: RecurringTransfer): SerializedRecurringTransfer {
  return {
    id: transfer.id,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amount: moneyToSerialized(transfer.amount),
    frequency: transfer.frequency,
    startDate: isoDateToSerialized(transfer.startDate),
    ...(transfer.endDate !== undefined ? { endDate: isoDateToSerialized(transfer.endDate) } : {}),
    ...(transfer.description !== undefined ? { description: transfer.description } : {}),
  };
}
