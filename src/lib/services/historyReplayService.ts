import "server-only";
import { getDb } from "./db.js";
import { createSqliteEntityHistoryRepository } from "../db/repositories/index.js";
import { parseAccount, type Account } from "../../domain/accounts/account.js";
import { parseIncome, type Income } from "../../domain/income/income.js";
import { parseExpense, type Expense } from "../../domain/expenses/expense.js";
import { parseLoan, type Loan } from "../../domain/loans/loan.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { Money, sumMoney } from "../../engine/money/money.js";
import { runSimulation } from "../../engine/simulation/simulate.js";
import { buildSimulationInput, loadSimulationInputs, toLiquiditySnapshots } from "./simulationBuilders.js";
import { reconstructAsOf } from "./historyReplay.js";
import { getLoanSchedule, MissingRateDataError } from "./loanService.js";
import { totalLiquidity } from "../../engine/metrics/liquidity.js";
import { computeEffortRate } from "../../engine/metrics/effortRate.js";
import { convertMoneyToCurrency } from "./exchangeRateService.js";
import { type SimulationProjectionPoint } from "./simulationService.js";

export interface BalanceTrajectoryPoint {
  date: string;
  balance: Money;
}

export interface BalanceTrajectory {
  /** Dense monthly series computed purely from income/expense/loan configuration as it
   * existed at each point in time — never reset by a manual balance correction. */
  projected: BalanceTrajectoryPoint[];
  /** Sparse series: every real balance the user has ever entered for this account,
   * oldest first (the first entry is the account's balance at creation). */
  actual: BalanceTrajectoryPoint[];
}

/**
 * Replays one account's balance history from creation to today, in two independent
 * series: `actual` (the real corrections the user entered) and `projected` (what the
 * configured income/expenses/loan payments predicted, replayed segment by segment using
 * whatever configuration was actually in effect at each point in time). The two are
 * never reconciled — the gap between them is the point of the chart that consumes this.
 *
 * V1 simplification: an income/expense/loan is considered "belongs to this account"
 * using its *current* accountId/sourceAccountId, not its historical one, so a rare
 * reassignment to a different account won't perfectly re-segment old history.
 */
export async function computeBalanceTrajectory(accountId: string): Promise<BalanceTrajectory> {
  const db = await getDb();
  const history = createSqliteEntityHistoryRepository(db);

  const [allAccountRows, allIncomeRows, allExpenseRows, allLoanRows] = await Promise.all([
    history.listByType("account"),
    history.listByType("income"),
    history.listByType("expense"),
    history.listByType("loan"),
  ]);

  const accountRows = allAccountRows.filter((r) => r.entityId === accountId);
  if (accountRows.length === 0) return { projected: [], actual: [] };

  const actual: BalanceTrajectoryPoint[] = accountRows
    .filter((r) => r.changeType === "save")
    .map((r) => ({ date: r.recordedAt.slice(0, 10), balance: parseAccount(r.snapshot).initialBalance }));

  const accountCreatedAt = accountRows[0]!.recordedAt;
  const nowIso = new Date().toISOString();

  const currentIncomes = reconstructAsOf(allIncomeRows, nowIso, parseIncome);
  const currentExpenses = reconstructAsOf(allExpenseRows, nowIso, parseExpense);
  const currentLoans = reconstructAsOf(allLoanRows, nowIso, parseLoan);
  const relevantIncomeIds = new Set([...currentIncomes.values()].filter((i) => i.accountId === accountId).map((i) => i.id));
  const relevantExpenseIds = new Set(
    [...currentExpenses.values()].filter((e) => e.accountId === accountId).map((e) => e.id),
  );
  const relevantLoanIds = new Set(
    [...currentLoans.values()].filter((l) => l.sourceAccountId === accountId).map((l) => l.id),
  );

  const configChangeTimestamps = [
    ...allIncomeRows.filter((r) => relevantIncomeIds.has(r.entityId)).map((r) => r.recordedAt),
    ...allExpenseRows.filter((r) => relevantExpenseIds.has(r.entityId)).map((r) => r.recordedAt),
    ...allLoanRows.filter((r) => relevantLoanIds.has(r.entityId)).map((r) => r.recordedAt),
  ]
    .filter((t) => t > accountCreatedAt)
    .sort();

  const boundaries = [accountCreatedAt, ...configChangeTimestamps, nowIso].filter(
    (t, i, arr) => i === 0 || t > arr[i - 1]!,
  );

  const projected: BalanceTrajectoryPoint[] = [];
  let openingBalance = parseAccount(accountRows[0]!.snapshot).initialBalance;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStartIso = boundaries[i]!;
    const segEndIso = boundaries[i + 1]!;
    const segStart = IsoDate.fromString(segStartIso.slice(0, 10));
    const segEnd = IsoDate.fromString(segEndIso.slice(0, 10));
    const monthsSpan = Math.max(1, segStart.monthsUntil(segEnd));

    const accountAsOf = reconstructAsOf(allAccountRows, segStartIso, parseAccount).get(accountId);
    if (!accountAsOf) continue; // account didn't exist yet, or was deleted, as of this segment's start

    const accountForSim: Account = { ...accountAsOf, initialBalance: openingBalance };
    const incomesAsOf = [...reconstructAsOf(allIncomeRows, segStartIso, parseIncome).values()].filter(
      (i): i is Income => i.accountId === accountId,
    );
    const expensesAsOf = [...reconstructAsOf(allExpenseRows, segStartIso, parseExpense).values()].filter(
      (e): e is Expense => e.accountId === accountId,
    );
    const loansAsOf = [...reconstructAsOf(allLoanRows, segStartIso, parseLoan).values()].filter(
      (l): l is Loan => l.sourceAccountId === accountId,
    );

    const simInput = await buildSimulationInput({
      accounts: [accountForSim],
      incomes: incomesAsOf,
      expenses: expensesAsOf,
      loans: loansAsOf,
      currency: accountForSim.currency,
      horizonStart: segStart,
      numberOfPeriods: monthsSpan,
    });
    const snapshots = runSimulation(simInput).filter((s) => !s.date.isAfter(segEnd));

    for (const snap of snapshots) {
      const accSnap = snap.accounts.find((a) => a.accountId === accountId);
      if (accSnap) projected.push({ date: snap.date.toString(), balance: accSnap.balance });
    }
    const lastSnap = snapshots[snapshots.length - 1];
    const lastAccSnap = lastSnap?.accounts.find((a) => a.accountId === accountId);
    if (lastAccSnap) {
      openingBalance = lastAccSnap.balance;
    } else {
      // Segment shorter than one full period (e.g. a config change earlier today, or the
      // final "up to now" segment for a just-created account) completes no period at
      // all — nothing has had time to move the balance yet, so plot it flat at segEnd
      // rather than leaving a gap.
      projected.push({ date: segEnd.toString(), balance: openingBalance });
    }
  }

  return { projected, actual };
}

export interface HistoricalProjection {
  /** Dense monthly series, shaped like a forward `SimulationProjectionPoint`, replayed
   * across ALL currently-active accounts together using whatever income/expense/loan
   * configuration was actually in effect at each point in time — from the earliest
   * active account's creation up to (excluding) today. */
  projected: SimulationProjectionPoint[];
  /** Sparse series: total liquidity across all active accounts at every date any one of
   * them got a real balance correction — that account's real balance plus every other
   * active account's latest known projected balance as of that date. */
  actual: { date: string; totalLiquidity: string }[];
  /** ISO date of the earliest currently-active account's creation, or undefined if there
   * are no active accounts — bounds how far back navigation can go. */
  earliestDate: string | undefined;
}

/**
 * Multi-account generalization of `computeBalanceTrajectory`, shaped to interoperate
 * with the forward simulation (`scenarioService.runScenarioAgainstBase`,
 * `dashboardService.getDashboardData`) so a caller can concatenate this with a forward
 * run into one continuous timeline and window across the "today" boundary. See that
 * function's docs for the segment-replay technique and its V1 simplifications, which
 * this shares (relevance based on each item's CURRENT accountId).
 */
export async function computeHistoricalProjection(): Promise<HistoricalProjection> {
  const { currency, activeAccountIds } = await loadSimulationInputs();
  if (activeAccountIds.size === 0) return { projected: [], actual: [], earliestDate: undefined };

  const db = await getDb();
  const history = createSqliteEntityHistoryRepository(db);
  const [allAccountRows, allIncomeRows, allExpenseRows, allLoanRows] = await Promise.all([
    history.listByType("account"),
    history.listByType("income"),
    history.listByType("expense"),
    history.listByType("loan"),
  ]);

  const creationByAccount = new Map<string, string>();
  for (const row of allAccountRows) {
    if (!activeAccountIds.has(row.entityId) || row.changeType !== "save") continue;
    if (!creationByAccount.has(row.entityId)) creationByAccount.set(row.entityId, row.recordedAt);
  }
  if (creationByAccount.size === 0) return { projected: [], actual: [], earliestDate: undefined };
  const earliestCreatedAt = [...creationByAccount.values()].sort()[0]!;
  const nowIso = new Date().toISOString();

  const currentIncomes = reconstructAsOf(allIncomeRows, nowIso, parseIncome);
  const currentExpenses = reconstructAsOf(allExpenseRows, nowIso, parseExpense);
  const currentLoans = reconstructAsOf(allLoanRows, nowIso, parseLoan);
  const relevantIncomeIds = new Set([...currentIncomes.values()].filter((i) => activeAccountIds.has(i.accountId)).map((i) => i.id));
  const relevantExpenseIds = new Set([...currentExpenses.values()].filter((e) => activeAccountIds.has(e.accountId)).map((e) => e.id));
  const relevantLoanIds = new Set([...currentLoans.values()].filter((l) => activeAccountIds.has(l.sourceAccountId)).map((l) => l.id));

  const configChangeTimestamps = [
    ...allAccountRows.filter((r) => activeAccountIds.has(r.entityId)).map((r) => r.recordedAt),
    ...allIncomeRows.filter((r) => relevantIncomeIds.has(r.entityId)).map((r) => r.recordedAt),
    ...allExpenseRows.filter((r) => relevantExpenseIds.has(r.entityId)).map((r) => r.recordedAt),
    ...allLoanRows.filter((r) => relevantLoanIds.has(r.entityId)).map((r) => r.recordedAt),
  ]
    .filter((t) => t > earliestCreatedAt)
    .sort();

  const boundaries = [earliestCreatedAt, ...configChangeTimestamps, nowIso].filter(
    (t, i, arr) => i === 0 || t > arr[i - 1]!,
  );

  const projected: SimulationProjectionPoint[] = [];
  const openingBalances = new Map<string, Money>();
  const perAccountProjectedByDate = new Map<string, Map<string, Money>>();

  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStartIso = boundaries[i]!;
    const segEndIso = boundaries[i + 1]!;
    const segStart = IsoDate.fromString(segStartIso.slice(0, 10));
    const segEnd = IsoDate.fromString(segEndIso.slice(0, 10));
    const monthsSpan = Math.max(1, segStart.monthsUntil(segEnd));

    const accountsAsOf = [...reconstructAsOf(allAccountRows, segStartIso, parseAccount).values()]
      .filter((a) => activeAccountIds.has(a.id))
      .map((a) => ({ ...a, initialBalance: openingBalances.get(a.id) ?? a.initialBalance }));
    if (accountsAsOf.length === 0) continue;
    const accountIdsAsOf = new Set(accountsAsOf.map((a) => a.id));

    const incomesAsOf = [...reconstructAsOf(allIncomeRows, segStartIso, parseIncome).values()].filter(
      (i): i is Income => accountIdsAsOf.has(i.accountId),
    );
    const expensesAsOf = [...reconstructAsOf(allExpenseRows, segStartIso, parseExpense).values()].filter(
      (e): e is Expense => accountIdsAsOf.has(e.accountId),
    );
    const loansAsOf = [...reconstructAsOf(allLoanRows, segStartIso, parseLoan).values()].filter(
      (l): l is Loan => accountIdsAsOf.has(l.sourceAccountId),
    );

    const simInput = await buildSimulationInput({
      accounts: accountsAsOf,
      incomes: incomesAsOf,
      expenses: expensesAsOf,
      loans: loansAsOf,
      currency,
      horizonStart: segStart,
      numberOfPeriods: monthsSpan,
    });
    const snapshots = runSimulation(simInput).filter((s) => !s.date.isAfter(segEnd));

    for (const snap of snapshots) {
      const liquiditySnap = toLiquiditySnapshots([snap])[0]!;
      const debtComponents = await Promise.all(
        snap.debtBreakdown.map(async (c) => {
          const loan = loansAsOf.find((l) => l.id === c.loanId);
          let outstanding = Money.zero(currency);
          if (loan) {
            try {
              const schedule = getLoanSchedule(loan);
              const entry = schedule[loan.startDate.monthsUntil(snap.date)];
              if (entry) outstanding = await convertMoneyToCurrency(entry.closingPrincipal, currency);
            } catch (error) {
              if (!(error instanceof MissingRateDataError)) throw error;
            }
          }
          return { loanId: c.loanId, accountId: c.accountId, amount: c.amount.toDecimalString(), outstanding: outstanding.toDecimalString() };
        }),
      );
      const totalOutstandingDebt = sumMoney(
        currency,
        debtComponents.map((c) => Money.fromDecimalString(c.outstanding, currency)),
      );

      projected.push({
        month: projected.length + 1,
        monthInYear: (projected.length % 12) + 1,
        date: snap.date.toString(),
        totalLiquidity: totalLiquidity(currency, liquiditySnap).toDecimalString(),
        totalIncome: snap.totalIncome.toDecimalString(),
        incomeComponents: snap.incomeBreakdown.map((c) => ({ itemId: c.itemId, accountId: c.accountId, amount: c.amount.toDecimalString() })),
        totalExpenses: snap.totalExpenses.toDecimalString(),
        expenseComponents: snap.expenseBreakdown.map((c) => ({ itemId: c.itemId, accountId: c.accountId, amount: c.amount.toDecimalString() })),
        totalDebtService: snap.totalDebtService.toDecimalString(),
        debtComponents,
        totalOutstandingDebt: totalOutstandingDebt.toDecimalString(),
        ...(snap.debtServiceRatePercent !== undefined ? { debtServiceRatePercent: snap.debtServiceRatePercent } : {}),
        ...(snap.totalIncome.isPositive()
          ? { effortRatePercent: computeEffortRate(snap.totalDebtService, snap.totalIncome).toString() }
          : {}),
        accountBalances: snap.accounts.map((a) => ({ accountId: a.accountId, balance: a.balance.toDecimalString() })),
      });

      for (const a of snap.accounts) {
        if (!perAccountProjectedByDate.has(a.accountId)) perAccountProjectedByDate.set(a.accountId, new Map());
        perAccountProjectedByDate.get(a.accountId)!.set(snap.date.toString(), a.balance);
      }
    }

    const lastSnap = snapshots[snapshots.length - 1];
    if (lastSnap) {
      for (const a of lastSnap.accounts) openingBalances.set(a.accountId, a.balance);
    }
  }

  // Real balance corrections per active account, oldest first.
  const actualByAccount = new Map<string, { date: string; balance: Money }[]>();
  for (const row of allAccountRows) {
    if (!activeAccountIds.has(row.entityId) || row.changeType !== "save") continue;
    const list = actualByAccount.get(row.entityId) ?? [];
    list.push({ date: row.recordedAt.slice(0, 10), balance: parseAccount(row.snapshot).initialBalance });
    actualByAccount.set(row.entityId, list);
  }

  function latestAtOrBefore(series: { date: string; balance: Money }[] | undefined, date: string): Money | undefined {
    let best: { date: string; balance: Money } | undefined;
    for (const point of series ?? []) {
      if (point.date <= date && (!best || point.date > best.date)) best = point;
    }
    return best?.balance;
  }

  const correctionDates = [...new Set([...actualByAccount.values()].flat().map((p) => p.date))].sort();
  const actual: { date: string; totalLiquidity: string }[] = [];
  for (const date of correctionDates) {
    const parts: Money[] = [];
    for (const accountId of activeAccountIds) {
      const correctionToday = actualByAccount.get(accountId)?.find((p) => p.date === date);
      const value =
        correctionToday?.balance ??
        latestAtOrBefore(actualByAccount.get(accountId), date) ??
        latestAtOrBefore(
          [...(perAccountProjectedByDate.get(accountId) ?? new Map()).entries()].map(([d, balance]) => ({ date: d, balance })),
          date,
        );
      if (value) parts.push(await convertMoneyToCurrency(value, currency));
    }
    if (parts.length > 0) actual.push({ date, totalLiquidity: sumMoney(currency, parts).toDecimalString() });
  }

  return { projected, actual, earliestDate: IsoDate.fromString(earliestCreatedAt.slice(0, 10)).toString() };
}
