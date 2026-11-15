import { type Money } from "../../engine/money/money.js";
import { formatMoney } from "../format.js";

/** The headline figures compared before vs after a change (a subset of the dashboard's). */
export interface ImpactMetrics {
  totalLiquidity: Money;
  availableLiquidity: Money;
  monthlyDebtObligations: Money;
  netMonthlyIncome: Money;
  effortRatePercent: string;
  projectedMinimumLiquidity: Money;
  debtOutstanding: Money;
  liquidityRunwayMonths: number | undefined;
}

export type ImpactKey = keyof ImpactMetrics;

/** For each figure, whether going up is good (green) or bad (red). */
const UP_IS_GOOD: Record<ImpactKey, boolean> = {
  totalLiquidity: true,
  availableLiquidity: true,
  monthlyDebtObligations: false,
  netMonthlyIncome: true,
  effortRatePercent: false,
  projectedMinimumLiquidity: true,
  debtOutstanding: false,
  liquidityRunwayMonths: true,
};

export interface ImpactRow {
  key: ImpactKey;
  before: string;
  after: string;
  /** Signed difference, e.g. "+€120.00" or "−2.5 pp"; undefined when unchanged. */
  delta?: string;
  tone: "better" | "worse" | "same";
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

function percent(value: string, lang: string): string {
  return `${Number(value).toLocaleString(lang, { maximumFractionDigits: 1 })}%`;
}

/**
 * Turns two metric snapshots into display rows: values formatted for `lang`, a signed
 * delta and a tone that accounts for direction (more debt is worse, more liquidity better).
 * `monthsLabel` formats a runway, e.g. (n) => `${n} months`; `noneLabel` is shown when
 * there's no runway limit.
 */
export function compareImpact(
  before: ImpactMetrics,
  after: ImpactMetrics,
  lang: string,
  monthsLabel: (n: number) => string,
  noneLabel: string,
): ImpactRow[] {
  const rows: ImpactRow[] = [];
  const tone = (key: ImpactKey, diff: number): ImpactRow["tone"] =>
    diff === 0 ? "same" : diff > 0 === UP_IS_GOOD[key] ? "better" : "worse";

  for (const key of Object.keys(UP_IS_GOOD) as ImpactKey[]) {
    if (key === "effortRatePercent") {
      const diff = Number(after.effortRatePercent) - Number(before.effortRatePercent);
      const rounded = Math.round(diff * 10) / 10;
      rows.push({
        key,
        before: percent(before.effortRatePercent, lang),
        after: percent(after.effortRatePercent, lang),
        ...(rounded !== 0 ? { delta: `${sign(rounded)}${Math.abs(rounded).toLocaleString(lang)} pp` } : {}),
        tone: tone(key, rounded),
      });
    } else if (key === "liquidityRunwayMonths") {
      const b = before.liquidityRunwayMonths;
      const a = after.liquidityRunwayMonths;
      // No runway figure means liquidity never runs out within the horizon: the best case.
      const diff = a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : a - b;
      rows.push({
        key,
        before: b === undefined ? noneLabel : monthsLabel(b),
        after: a === undefined ? noneLabel : monthsLabel(a),
        ...(a !== undefined && b !== undefined && diff !== 0 ? { delta: `${sign(diff)}${Math.abs(diff)}` } : {}),
        tone: tone(key, diff),
      });
    } else {
      const b = before[key];
      const a = after[key];
      if (a.currency !== b.currency) {
        // Base currency itself changed: the two figures aren't comparable.
        rows.push({ key, before: formatMoney(b, lang), after: formatMoney(a, lang), tone: "same" });
        continue;
      }
      const diff = a.sub(b);
      const n = diff.isZero() ? 0 : diff.isNegative() ? -1 : 1;
      rows.push({
        key,
        before: formatMoney(b, lang),
        after: formatMoney(a, lang),
        ...(n !== 0 ? { delta: `${sign(n)}${formatMoney(diff.isNegative() ? diff.neg() : diff, lang)}` } : {}),
        tone: tone(key, n),
      });
    }
  }
  return rows;
}
