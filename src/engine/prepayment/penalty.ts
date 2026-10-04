import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";

/**
 * Penalty rules as DATA (spec section 12) — never a hard-coded percentage in
 * calculation logic. Domain/loans stores this on a Loan; the AI contract extractor
 * may suggest one, but only after user verification does it become authoritative.
 */
export type PrepaymentPenaltyRule =
  | { type: "none" }
  | { type: "percentage"; rate: Decimal; maximumPenalty?: Money }
  | { type: "fixed"; fixedAmount: Money };

/** Computes the penalty owed for prepaying `prepaymentAmount` under `rule`. */
export function computePrepaymentPenalty(rule: PrepaymentPenaltyRule, prepaymentAmount: Money): Money {
  const currency = prepaymentAmount.currency;
  if (rule.type === "none") {
    return Money.zero(currency);
  }
  if (rule.type === "fixed") {
    return rule.fixedAmount;
  }
  let penalty = prepaymentAmount.mulDecimal(rule.rate);
  if (rule.maximumPenalty !== undefined) {
    penalty = penalty.min(rule.maximumPenalty);
  }
  return penalty;
}
