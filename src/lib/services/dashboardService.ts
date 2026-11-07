import "server-only";
import { type Account } from "../../domain/accounts/account.js";
import { getLoanSchedule, periodsElapsedBefore, MissingRateDataError } from "./loanService.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { Money, sumMoney } from "../../engine/money/money.js";
import { runSimulation, type SimulationDebtPayment } from "../../engine/simulation/simulate.js";
import {
  totalLiquidity,
  availableLiquidity,
  minimumLiquidity,
  liquidityRunway,
  findLiquidityBreaches,
} from "../../engine/metrics/liquidity.js";
import { computeSavingsTrend } from "../../engine/metrics/savingsTrend.js";
import { computeEffortRate } from "../../engine/metrics/effortRate.js";
import { convertMoneyToCurrency } from "./exchangeRateService.js";
import {
  loadSimulationInputs,
  alignLoanScheduleToSimulation,
  buildSimulationIncomeItems,
  buildSimulationExpenseItems,
  buildSimulationAccounts,
  toLiquiditySnapshots,
} from "./simulationBuilders.js";
import { computeBalanceTrajectory, computeHistoricalProjection } from "./historyReplayService.js";

const HORIZON_MONTHS = 12;
/** Timeline navigation caps at ~99 years out, matching the simulation page. */
export const MAX_DASHBOARD_MONTH_OFFSET = 99 * HORIZON_MONTHS;

export interface DashboardLoanWarning {
  loanId: string;
  loanName: string;
  message: string;
}

export interface DashboardData {
  currency: string;
  accounts: Account[];
  totalLiquidity: Money;
  availableLiquidity: Money;
  monthlyDebtObligations: Money;
  netMonthlyIncome: Money;
  effortRatePercent: string;
  projectedMinimumLiquidity: Money;
  liquidityRunwayMonths: number | undefined;
  debtOutstanding: Money;
  liquidityBreachMonths: number[];
  loanWarnings: DashboardLoanWarning[];
  projection: { month: number; date: string; totalLiquidity: string }[];
  /** Sparse real-balance checkpoints falling inside the displayed window — see
   * historyReplayService.computeHistoricalProjection. */
  actual: { date: string; totalLiquidity: string }[];
  /** Trend line extrapolated from the real balance checkpoints' average savings per
   * period (see engine/metrics/savingsTrend), one value per displayed month on or after
   * the latest checkpoint. Empty with fewer than two checkpoints. */
  savingsTrend: { date: string; totalLiquidity: string }[];
  /** Average monthly savings behind `savingsTrend`, or undefined when there's no trend. */
  averageMonthlySavings: Money | undefined;
  monthOffset: number;
  /** Most negative `monthOffset` the timeline can be paged back to — bounded by the
   * earliest active account's creation date (0 when there's no history to replay). */
  minMonthOffset: number;
  /** ISO date of the first and last month in the currently displayed 12-month window. */
  windowStartDate: string;
  windowEndDate: string;
}

/**
 * Loads accounts/loans/income/expenses and runs a base-scenario simulation from today
 * through the end of the selected 12-month window, then derives the headline dashboard
 * metrics from it. This is the only place the dashboard page touches domain/engine
 * code — the page itself only formats and renders what this returns.
 *
 * `monthOffset` (minMonthOffset..MAX_DASHBOARD_MONTH_OFFSET, clamped) slides that window
 * across the timeline, same as the simulation page — 0 shows the next 12 months from
 * today, 1 shifts one month further out, a negative offset pages back into the past
 * (served from `computeHistoricalProjection`'s replay of the config that actually stood
 * at each point in time, stitched onto this forward run). The forward simulation itself
 * always runs from today (period 1) through the window's end when the window reaches
 * into the future; only the final 12 periods of the combined past+future timeline are
 * surfaced as `projection`.
 *
 * Monetary inputs are normalized to the selected base currency before simulation,
 * using stored FX rates and live-rate fallback (see exchangeRateService).
 */
export async function getDashboardData(monthOffset = 0): Promise<DashboardData> {
  const historical = await computeHistoricalProjection();
  const minMonthOffset = historical.projected.length > 0 ? -historical.projected.length : 0;
  const clampedMonthOffset = Math.min(Math.max(Math.trunc(monthOffset), minMonthOffset), MAX_DASHBOARD_MONTH_OFFSET);
  const totalMonths = HORIZON_MONTHS + Math.max(clampedMonthOffset, 0);

  const { accounts, loans, incomes, expenses, currency, activeAccounts, activeAccountIds } = await loadSimulationInputs();

  const debtPayments: SimulationDebtPayment[] = [];
  const loanWarnings: DashboardLoanWarning[] = [];
  let monthlyDebtObligations = Money.zero(currency);
  let debtOutstanding = Money.zero(currency);
  const today = IsoDate.fromString(new Date().toISOString().slice(0, 10));

  for (const loan of loans) {
    try {
      // Outstanding balance and current payment are what's actually owed/due as of
      // today (principal paid down, and rate/payment rolled over if the loan's fixed
      // period already ended) — not the loan's original first payment, which stays
      // fixed in the record for the life of the loan.
      const fullSchedule = getLoanSchedule(loan);
      const todaysEntry = fullSchedule[periodsElapsedBefore(loan, today)];
      const outstandingPrincipal = todaysEntry?.openingPrincipal ?? Money.zero(loan.principal.currency);
      debtOutstanding = debtOutstanding.add(await convertMoneyToCurrency(outstandingPrincipal, currency));
      if (!activeAccountIds.has(loan.sourceAccountId)) {
        loanWarnings.push({
          loanId: loan.id,
          loanName: loan.name,
          message: `Loan references missing source account "${loan.sourceAccountId}" and is excluded from cashflow simulation.`,
        });
        continue;
      }
      // The loan almost never starts exactly on `today` — its own schedule (period 1 =
      // loan.startDate) must be re-indexed onto the simulation's period numbering
      // (period 1 = today) before feeding it in, or a loan mid-life gets treated as
      // freshly originated.
      const loanPeriodOffset = loan.startDate.monthsUntil(today);
      const schedule = alignLoanScheduleToSimulation(fullSchedule, loanPeriodOffset, totalMonths);
      for (const entry of schedule) {
        debtPayments.push({
          accountId: loan.sourceAccountId,
          period: entry.period,
          amount: await convertMoneyToCurrency(entry.totalCashOutflow, currency),
        });
      }
      if (todaysEntry) {
        monthlyDebtObligations = monthlyDebtObligations.add(await convertMoneyToCurrency(todaysEntry.totalCashOutflow, currency));
      }
    } catch (error) {
      if (error instanceof MissingRateDataError) {
        loanWarnings.push({ loanId: loan.id, loanName: loan.name, message: error.message });
      } else {
        throw error;
      }
    }
  }

  const incomeItems = await buildSimulationIncomeItems(incomes, activeAccountIds, currency);
  const expenseItems = await buildSimulationExpenseItems(expenses, activeAccountIds, currency);

  // Net monthly income (for the effort rate): v1 sums only monthly-frequency income
  // items directly, since normalizing other frequencies to a monthly-equivalent is a
  // period-conversion concern this dashboard doesn't yet implement.
  const netMonthlyIncome = sumMoney(
    currency,
    await Promise.all(
      incomes
        .filter((i) => i.frequency === "monthly" && activeAccountIds.has(i.accountId))
        .map((i) => convertMoneyToCurrency(i.amount, currency)),
    ),
  );

  // Always the actual current month, so "projected minimum liquidity" reflects the next 12
  // months from today rather than a fixed calendar year.
  const horizonStart = IsoDate.fromString(new Date().toISOString().slice(0, 10));

  const simulationAccounts = await buildSimulationAccounts(activeAccounts, currency);
  const currentTotalLiquidity = sumMoney(
    currency,
    simulationAccounts.map((a) => a.initialBalance),
  );
  const currentAvailableLiquidity = currentTotalLiquidity.sub(
    sumMoney(
      currency,
      simulationAccounts.map((a) => a.minimumReserve),
    ),
  );

  const snapshots =
    activeAccounts.length > 0
      ? runSimulation({
          currency,
          accounts: simulationAccounts,
          incomeItems,
          expenseItems,
          debtPayments,
          events: [],
          horizonStart,
          periodFrequency: "monthly",
          numberOfPeriods: totalMonths,
        })
      : [];

  const liquiditySnapshots = toLiquiditySnapshots(snapshots);

  // "Projected minimum liquidity"/runway/breaches always reflect the forward run's own
  // 12-month window (today onward), regardless of which past/future window is charted —
  // same choice scenarioService makes for its own impact figures.
  const windowSnapshots = liquiditySnapshots.slice(totalMonths - HORIZON_MONTHS, totalMonths);
  const projectedMinimumLiquidity =
    windowSnapshots.length > 0 ? minimumLiquidity(currency, windowSnapshots) : currentAvailableLiquidity;
  const runwayMonths = liquiditySnapshots.length > 0 ? liquidityRunway(currency, liquiditySnapshots) : undefined;
  const breaches = liquiditySnapshots.length > 0 ? findLiquidityBreaches(currency, liquiditySnapshots) : [];
  const breachMonths = [...new Set(breaches.map((b) => b.period))].sort((a, b) => a - b);

  const effortRatePercent = netMonthlyIncome.isPositive()
    ? computeEffortRate(monthlyDebtObligations, netMonthlyIncome).toString()
    : "0";

  // Stitch the historical replay (dates before today) onto the forward run, then slice
  // out the requested 12-month window — mirrors scenarioService.runScenarioAgainstBase.
  const historicalProjection = historical.projected.map((p) => ({ date: p.date, totalLiquidity: p.totalLiquidity }));
  const forwardProjection = liquiditySnapshots.map((s) => ({ date: s.date.toString(), totalLiquidity: totalLiquidity(currency, s).toDecimalString() }));
  const mergedProjection = [...historicalProjection, ...forwardProjection];
  const windowStartIndex = historical.projected.length + clampedMonthOffset;
  const windowMerged = mergedProjection.slice(windowStartIndex, windowStartIndex + HORIZON_MONTHS);
  const windowStartDate = windowMerged[0]?.date ?? horizonStart.toString();
  const windowEndDate = windowMerged[windowMerged.length - 1]?.date ?? horizonStart.toString();

  const trend = computeSavingsTrend(
    currency,
    historical.actual.map((a) => ({ date: IsoDate.fromString(a.date), balance: Money.fromDecimalString(a.totalLiquidity, currency) })),
  );
  const savingsTrend = trend
    ? windowMerged
        .filter((p) => !IsoDate.fromString(p.date).isBefore(trend.anchor.date))
        .map((p) => ({ date: p.date, totalLiquidity: trend.valueAt(IsoDate.fromString(p.date)).toDecimalString() }))
    : [];

  return {
    currency,
    accounts,
    totalLiquidity: currentTotalLiquidity,
    availableLiquidity: currentAvailableLiquidity,
    monthlyDebtObligations,
    netMonthlyIncome,
    effortRatePercent,
    projectedMinimumLiquidity,
    liquidityRunwayMonths: runwayMonths,
    debtOutstanding,
    liquidityBreachMonths: breachMonths,
    loanWarnings,
    monthOffset: clampedMonthOffset,
    minMonthOffset,
    windowStartDate,
    windowEndDate,
    actual: historical.actual.filter((a) => a.date >= windowStartDate && a.date <= windowEndDate),
    savingsTrend,
    averageMonthlySavings: trend?.averageMonthlySavings,
    projection: windowMerged.map((p, index) => ({
      month: index + 1,
      date: p.date,
      totalLiquidity: p.totalLiquidity,
    })),
  };
}

export interface BalanceDriftData {
  accountId: string | undefined;
  projected: { date: string; balance: string }[];
  actual: { date: string; balance: string }[];
}

/**
 * Projected-vs-actual balance drift for one account (defaults to the `isDefault`
 * account, or the first account, when `accountId` is omitted) — see
 * historyReplayService.computeBalanceTrajectory for how the two series are computed.
 * Returns an empty result when there are no accounts at all.
 */
export async function getBalanceDriftData(accountId?: string): Promise<BalanceDriftData> {
  const { accounts } = await loadSimulationInputs();
  const account = accountId
    ? accounts.find((a) => a.id === accountId)
    : (accounts.find((a) => a.isDefault) ?? accounts[0]);
  if (!account) return { accountId: undefined, projected: [], actual: [] };

  const { projected, actual } = await computeBalanceTrajectory(account.id);
  return {
    accountId: account.id,
    projected: projected.map((p) => ({ date: p.date, balance: p.balance.toDecimalString() })),
    actual: actual.map((p) => ({ date: p.date, balance: p.balance.toDecimalString() })),
  };
}
