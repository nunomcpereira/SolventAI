import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { type LedgerEntry } from "./ledger.js";

export interface TransferRequest {
  id: string;
  date: IsoDate;
  fromAccountId: string;
  toAccountId: string;
  /** Amount debited from the source account, in the source account's currency. */
  amount: Money;
  /**
   * Amount credited to the destination account. Required whenever destination currency
   * differs from source currency (explicit FX conversion — see spec section 6; this
   * module never invents a rate). For a same-currency transfer this must equal `amount`.
   */
  creditedAmount: Money;
  description?: string;
}

export interface AccountTransferEntries {
  fromEntry: LedgerEntry;
  toEntry: LedgerEntry;
}

/**
 * Builds the matched pair of ledger entries for an inter-account transfer. Does not
 * apply them — pass each to `applyLedgerEntries` on the respective account's entry list.
 * Same-currency transfers must have `amount.equals(creditedAmount)`, enforced here so a
 * caller cannot silently create or destroy money via a mismatched pair.
 */
export function buildTransferEntries(request: TransferRequest): AccountTransferEntries {
  if (request.amount.currency === request.creditedAmount.currency && !request.amount.equals(request.creditedAmount)) {
    throw new Error(
      `buildTransferEntries: same-currency transfer ${request.id} must credit the exact debited amount`,
    );
  }
  if (request.amount.isNegative() || request.amount.isZero()) {
    throw new Error(`buildTransferEntries: transfer ${request.id} amount must be positive`);
  }

  return {
    fromEntry: {
      id: `${request.id}:out`,
      date: request.date,
      type: "transfer_out",
      amount: request.amount,
      ...(request.description !== undefined ? { description: request.description } : {}),
    },
    toEntry: {
      id: `${request.id}:in`,
      date: request.date,
      type: "transfer_in",
      amount: request.creditedAmount,
      ...(request.description !== undefined ? { description: request.description } : {}),
    },
  };
}
