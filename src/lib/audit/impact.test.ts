import { describe, expect, it } from "vitest";
import { Money } from "../../engine/money/money.js";
import { compareImpact, type ImpactMetrics } from "./impact.js";

const eur = (v: string) => Money.fromDecimalString(v, "EUR");
const base: ImpactMetrics = {
  totalLiquidity: eur("1000"),
  availableLiquidity: eur("800"),
  monthlyDebtObligations: eur("500"),
  netMonthlyIncome: eur("2000"),
  effortRatePercent: "25",
  projectedMinimumLiquidity: eur("300"),
  debtOutstanding: eur("100000"),
  liquidityRunwayMonths: undefined,
};
const months = (n: number) => `${n} months`;

describe("compareImpact", () => {
  it("marks every figure unchanged when nothing moved", () => {
    const rows = compareImpact(base, base, "en", months, "none");
    expect(rows.every((r) => r.tone === "same" && r.delta === undefined)).toBe(true);
  });

  it("judges direction per figure: more debt is worse, more liquidity better", () => {
    const after = { ...base, monthlyDebtObligations: eur("600"), effortRatePercent: "30", totalLiquidity: eur("1200") };
    const byKey = Object.fromEntries(compareImpact(base, after, "en", months, "none").map((r) => [r.key, r]));
    expect(byKey["monthlyDebtObligations"]).toMatchObject({ tone: "worse", delta: "+€100.00" });
    expect(byKey["effortRatePercent"]).toMatchObject({ tone: "worse", delta: "+5 pp", before: "25%", after: "30%" });
    expect(byKey["totalLiquidity"]).toMatchObject({ tone: "better", delta: "+€200.00" });
  });

  it("treats a new liquidity shortfall as worse than none", () => {
    const after = { ...base, liquidityRunwayMonths: 4 };
    const runway = compareImpact(base, after, "en", months, "none").find((r) => r.key === "liquidityRunwayMonths");
    expect(runway).toMatchObject({ before: "none", after: "4 months", tone: "worse" });
  });

  it("doesn't diff figures in different currencies", () => {
    const after = { ...base, totalLiquidity: Money.fromDecimalString("1000", "USD") };
    const row = compareImpact(base, after, "en", months, "none").find((r) => r.key === "totalLiquidity");
    expect(row).toMatchObject({ tone: "same" });
    expect(row?.delta).toBeUndefined();
  });
});
