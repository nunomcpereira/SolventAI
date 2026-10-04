import { IsoDate } from "../dates/isoDate.js";
import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";
import { type PrepaymentStrategy } from "../prepayment/prepayment.js";

export type SimulationEventPayload =
  | { type: "balance_override"; accountId: string; newBalance: Money }
  | { type: "rate_change"; loanId: string; index: string; newAnnualValue: Decimal }
  /** `endDate` (optional, inclusive): last day the new amount applies — from the first
   * period starting after it, the item reverts to its configured amount. */
  | { type: "income_change"; incomeId: string; newAmount: Money; endDate?: IsoDate }
  | { type: "expense_change"; expenseId: string; newAmount: Money; endDate?: IsoDate }
  | { type: "one_time_income"; accountId: string; amount: Money; description?: string }
  | { type: "account_transfer"; fromAccountId: string; toAccountId: string; amount: Money; creditedAmount: Money }
  | { type: "prepayment"; loanId: string; sourceAccountId: string; amount: Money; strategy: PrepaymentStrategy }
  | { type: "one_time_expense"; accountId: string; amount: Money; description?: string };

export type SimulationEventType = SimulationEventPayload["type"];

export interface SimulationEvent {
  id: string;
  date: IsoDate;
  payload: SimulationEventPayload;
}

/**
 * Fixed, documented priority for events landing on the same date (spec section 20,
 * "Events occurring on the same date must have deterministic ordering"):
 *   1. balance_override — establishes the period's starting facts first.
 *   2. rate_change       — new rates apply before anything else is computed off them.
 *   3. income_change / expense_change — recurring-amount adjustments, before any cash moves.
 *   4. one_time_income   — inflows land before internal transfers or outflows.
 *   5. account_transfer  — internal movement, before external outflows.
 *   6. prepayment        — a deliberate debt paydown, after ordinary transfers.
 *   7. one_time_expense  — external outflows apply last.
 * Ties within the same (date, type) are broken by event id (lexicographic), so the
 * ordering is total and reproducible for any input.
 */
const TYPE_PRIORITY: Readonly<Record<SimulationEventType, number>> = {
  balance_override: 0,
  rate_change: 1,
  income_change: 2,
  expense_change: 3,
  one_time_income: 4,
  account_transfer: 5,
  prepayment: 6,
  one_time_expense: 7,
};

/** Sorts events by (date, type priority, id) — the single canonical ordering used everywhere. */
export function orderEvents(events: readonly SimulationEvent[]): SimulationEvent[] {
  return [...events].sort((a, b) => {
    const dateCompare = a.date.compare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const priorityCompare = TYPE_PRIORITY[a.payload.type] - TYPE_PRIORITY[b.payload.type];
    if (priorityCompare !== 0) return priorityCompare;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
