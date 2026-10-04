import { Money, sumMoney } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";

/**
 * All components must be non-negative (each represents a magnitude, not a signed
 * delta) except `openingCash`, which may be negative (an account already overdrawn).
 * Sign convention lives entirely in the formula below, not in the inputs — this
 * keeps a caller from accidentally double-negating an outflow.
 */
export interface CashFlowComponents {
  openingCash: Money;
  income: Money;
  transfersIn: Money;
  livingExpenses: Money;
  debtPayments: Money;
  fees: Money;
  prepayments: Money;
  transfersOut: Money;
}

export interface CashFlowResult extends CashFlowComponents {
  closingCash: Money;
}

const MAGNITUDE_FIELDS = [
  "income",
  "transfersIn",
  "livingExpenses",
  "debtPayments",
  "fees",
  "prepayments",
  "transfersOut",
] as const satisfies readonly (keyof CashFlowComponents)[];

/**
 * Computes one period's cash flow per the canonical formula (spec section 15):
 *   Closing Cash = Opening Cash + Income + Transfers In
 *                  - Living Expenses - Debt Payments - Fees - Prepayments - Transfers Out
 * This is the single authoritative implementation — no other layer may recompute it.
 */
export function computeCashFlowPeriod(components: CashFlowComponents): CashFlowResult {
  const currency: CurrencyCode = components.openingCash.currency;
  for (const field of MAGNITUDE_FIELDS) {
    const value = components[field];
    if (value.currency !== currency) {
      throw new Error(`computeCashFlowPeriod: ${field} currency ${value.currency} does not match ${currency}`);
    }
    if (value.isNegative()) {
      throw new Error(`computeCashFlowPeriod: ${field} must be non-negative (magnitude, not signed delta)`);
    }
  }

  const closingCash = components.openingCash
    .add(components.income)
    .add(components.transfersIn)
    .sub(components.livingExpenses)
    .sub(components.debtPayments)
    .sub(components.fees)
    .sub(components.prepayments)
    .sub(components.transfersOut);

  return { ...components, closingCash };
}

/**
 * Chains a sequence of per-period component sets, wiring each period's closing cash
 * into the next period's opening cash (overwriting any `openingCash` the caller passed
 * for periods after the first, since it must equal the prior closing balance).
 */
export function runCashFlowSeries(
  initialCash: Money,
  periods: readonly Omit<CashFlowComponents, "openingCash">[],
): CashFlowResult[] {
  const results: CashFlowResult[] = [];
  let opening = initialCash;
  for (const period of periods) {
    const result = computeCashFlowPeriod({ ...period, openingCash: opening });
    results.push(result);
    opening = result.closingCash;
  }
  return results;
}

/** Sums closing cash across multiple accounts' single-period results, same currency. */
export function totalLiquidity(currency: CurrencyCode, results: readonly CashFlowResult[]): Money {
  return sumMoney(currency, results.map((r) => r.closingCash));
}
