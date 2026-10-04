import { Money } from "../money/money.js";
import { Decimal } from "../money/decimal.js";

/**
 * Effort rate / DTI (spec section 17):
 *   Effort Rate = Total Monthly Debt Obligations / Net Monthly Income × 100
 * Returns the numeric percentage (e.g. "32.5" means 32.5%) — this module never
 * classifies it as healthy/warning/critical; that's presentation, owned by the UI.
 */
export function computeEffortRate(totalMonthlyDebtObligations: Money, netMonthlyIncome: Money): Decimal {
  if (totalMonthlyDebtObligations.currency !== netMonthlyIncome.currency) {
    throw new Error("computeEffortRate: currency mismatch between debt obligations and income");
  }
  if (!netMonthlyIncome.isPositive()) {
    throw new Error("computeEffortRate: netMonthlyIncome must be positive");
  }
  const ratio = Decimal.fromBigInt(totalMonthlyDebtObligations.minorUnits).div(
    Decimal.fromBigInt(netMonthlyIncome.minorUnits),
  );
  return ratio.mul(Decimal.fromBigInt(100n));
}
