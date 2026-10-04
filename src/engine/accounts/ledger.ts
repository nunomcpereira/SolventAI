import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";

export type AccountType = "checking" | "savings" | "emergency" | "investment" | "other";

/**
 * A single ledger movement against one account. `transfer_in`/`transfer_out` are
 * distinguished from `deposit`/`withdrawal` only for reporting — both affect the
 * balance the same way. Pairing a transfer_out on one account with a transfer_in on
 * another (same date, equal amount, converted at the applicable FX rate) is the
 * caller's responsibility; see engine/cashflow for the invariant that a same-currency
 * internal transfer never changes total liquidity.
 */
export type LedgerEntryType = "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "balance_override";

export interface LedgerEntry {
  id: string;
  date: IsoDate;
  type: LedgerEntryType;
  /**
   * For deposit/withdrawal/transfer_*, the (always non-negative) movement amount.
   * For balance_override, the new absolute balance (not a delta) — used only to seed
   * or correct state (e.g. initial import), and explicitly breaks the additive
   * conservation invariant, which callers must account for separately.
   */
  amount: Money;
  description?: string;
}

export interface LedgerStep {
  entry: LedgerEntry;
  openingBalance: Money;
  closingBalance: Money;
}

export interface AccountLedgerResult {
  currency: CurrencyCode;
  openingBalance: Money;
  closingBalance: Money;
  steps: LedgerStep[];
}

/**
 * Applies a chronologically-ordered list of ledger entries to `initialBalance`,
 * returning the running balance after each step. Entries must be pre-sorted by date
 * (and by caller-defined tie-break for same-day entries — see engine/simulation for
 * the canonical same-date event ordering); this function does not re-sort, so that
 * ordering stays visible and auditable to the caller.
 */
export function applyLedgerEntries(initialBalance: Money, entries: readonly LedgerEntry[]): AccountLedgerResult {
  const currency = initialBalance.currency;
  let balance = initialBalance;
  const steps: LedgerStep[] = [];

  for (const entry of entries) {
    if (entry.amount.currency !== currency) {
      throw new Error(
        `applyLedgerEntries: entry ${entry.id} currency ${entry.amount.currency} does not match account currency ${currency}`,
      );
    }
    const opening = balance;
    let closing: Money;
    switch (entry.type) {
      case "deposit":
      case "transfer_in":
        assertNonNegative(entry, "amount");
        closing = opening.add(entry.amount);
        break;
      case "withdrawal":
      case "transfer_out":
        assertNonNegative(entry, "amount");
        closing = opening.sub(entry.amount);
        break;
      case "balance_override":
        closing = entry.amount;
        break;
      default: {
        const exhaustive: never = entry.type;
        throw new Error(`Unhandled ledger entry type: ${String(exhaustive)}`);
      }
    }
    steps.push({ entry, openingBalance: opening, closingBalance: closing });
    balance = closing;
  }

  return { currency, openingBalance: initialBalance, closingBalance: balance, steps };
}

function assertNonNegative(entry: LedgerEntry, field: string): void {
  if (entry.amount.isNegative()) {
    throw new Error(`applyLedgerEntries: entry ${entry.id} ${field} must be non-negative for type "${entry.type}"`);
  }
}

/**
 * Verifies the account-conservation invariant for a stretch of entries containing no
 * `balance_override` steps: closingBalance === openingBalance + inflows - outflows.
 * Throws (rather than returning false) so a violated invariant cannot be silently
 * ignored by a caller that forgets to check a boolean.
 */
export function assertConserves(result: AccountLedgerResult): void {
  let inflows = Money.zero(result.currency);
  let outflows = Money.zero(result.currency);
  for (const step of result.steps) {
    if (step.entry.type === "balance_override") {
      throw new Error("assertConserves: cannot verify conservation across a balance_override entry");
    }
    if (step.entry.type === "deposit" || step.entry.type === "transfer_in") {
      inflows = inflows.add(step.entry.amount);
    } else {
      outflows = outflows.add(step.entry.amount);
    }
  }
  const expected = result.openingBalance.add(inflows).sub(outflows);
  if (!expected.equals(result.closingBalance)) {
    throw new Error(
      `assertConserves: closingBalance ${result.closingBalance.toDecimalString()} != expected ${expected.toDecimalString()}`,
    );
  }
}

export interface AccountLimits {
  minimumReserve: Money;
}

/** Returns the ledger steps at which the balance fell below `limits.minimumReserve`. */
export function findReserveBreaches(result: AccountLedgerResult, limits: AccountLimits): LedgerStep[] {
  return result.steps.filter((step) => step.closingBalance.compare(limits.minimumReserve) < 0);
}
