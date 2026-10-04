import { z } from "zod";
import { Money } from "../../engine/money/money.js";
import { type AccountType } from "../../engine/accounts/ledger.js";
import {
  moneySchema,
  moneyToSerialized,
  moneyFromSerialized,
  type SerializedMoney,
  DomainValidationError,
  type Repository,
} from "../shared/index.js";

export type { AccountType };

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: Money;
  minimumReserve: Money;
  active: boolean;
  /** At most one account is the default at a time (enforced in accountsService.setDefaultAccount,
   * not here — this is just a plain flag as far as domain validation is concerned). */
  isDefault: boolean;
}

export interface AccountRepository extends Repository<Account> {
  /** Atomically clears isDefault on every other account and sets it on this one. */
  setDefault(id: string): Promise<void>;
}

const accountTypeSchema = z.enum(["checking", "savings", "emergency", "investment", "other"]);

/** Raw (JSON/DB-friendly) shape validated at the boundary before becoming an Account. */
export const accountInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "name is required"),
  type: accountTypeSchema,
  currency: z.string(),
  initialBalance: moneySchema,
  minimumReserve: moneySchema,
  active: z.boolean(),
  isDefault: z.boolean().default(false),
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export interface SerializedAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: SerializedMoney;
  minimumReserve: SerializedMoney;
  active: boolean;
  isDefault: boolean;
}

/** Validates and maps raw input into a domain Account. Throws DomainValidationError. */
export function parseAccount(raw: unknown): Account {
  const result = accountInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("Account", result.error);
  }
  const input = result.data;

  if (input.initialBalance.currency !== input.currency) {
    throw new DomainValidationError(
      "Account",
      zodIssue("initialBalance.currency", "must match account currency"),
    );
  }
  if (input.minimumReserve.currency !== input.currency) {
    throw new DomainValidationError(
      "Account",
      zodIssue("minimumReserve.currency", "must match account currency"),
    );
  }
  const minimumReserve = moneyFromSerialized(input.minimumReserve);
  if (minimumReserve.isNegative()) {
    throw new DomainValidationError("Account", zodIssue("minimumReserve", "must not be negative"));
  }

  return {
    id: input.id,
    name: input.name,
    type: input.type,
    currency: input.currency,
    initialBalance: moneyFromSerialized(input.initialBalance),
    minimumReserve,
    active: input.active,
    isDefault: input.isDefault,
  };
}

export function serializeAccount(account: Account): SerializedAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    initialBalance: moneyToSerialized(account.initialBalance),
    minimumReserve: moneyToSerialized(account.minimumReserve),
    active: account.active,
    isDefault: account.isDefault,
  };
}

function zodIssue(path: string, message: string): z.ZodError {
  return new z.ZodError([{ code: "custom", path: [path], message }]);
}
