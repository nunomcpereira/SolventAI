import "server-only";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import {
  createSqliteAccountRepository,
  createSqliteLoanRepository,
  createSqliteIncomeRepository,
  createSqliteExpenseRepository,
  createSqliteSettingsRepository,
} from "../db/repositories/index.js";
import { type Account } from "../../domain/accounts/account.js";
import { type Loan } from "../../domain/loans/loan.js";
import { type Income } from "../../domain/income/income.js";
import { type Expense } from "../../domain/expenses/expense.js";
import {
  type SimulationIncomeItem,
  type SimulationExpenseItem,
  type SimulationDebtPayment,
  type SimulationInput,
  type SimulationPeriodSnapshot,
} from "../../engine/simulation/simulate.js";
import { type CurrencyCode } from "../../engine/money/currency.js";
import { type IsoDate } from "../../engine/dates/isoDate.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { type PeriodLiquiditySnapshot } from "../../engine/metrics/liquidity.js";
import { convertMoneyToCurrency } from "./exchangeRateService.js";
import { getLoanSchedule, MissingRateDataError } from "./loanService.js";

/** Loads the raw account/loan/income/expense/settings data both dashboardService and
 * scenarioService simulate against, and derives the shared currency/active-account
 * filtering every simulation run needs before building its own debt-payment schedule. */
export async function loadSimulationInputs(): Promise<{
  accounts: Account[];
  loans: Loan[];
  incomes: Income[];
  expenses: Expense[];
  currency: string;
  activeAccounts: Account[];
  activeAccountIds: Set<string>;
}> {
  const db = await getDb();
  await ensureSeeded(db);

  const [accounts, loans, incomes, expenses, settings] = await Promise.all([
    createSqliteAccountRepository(db).list(),
    createSqliteLoanRepository(db).list(),
    createSqliteIncomeRepository(db).list(),
    createSqliteExpenseRepository(db).list(),
    createSqliteSettingsRepository(db).get(),
  ]);

  const currency = settings?.baseCurrency ?? accounts[0]?.currency ?? "EUR";
  const activeAccounts = accounts.filter((a) => a.active);
  const activeAccountIds = new Set(activeAccounts.map((a) => a.id));

  return { accounts, loans, incomes, expenses, currency, activeAccounts, activeAccountIds };
}

/** Re-indexes a loan's own schedule (period 1 = loan.startDate) onto the simulation's
 * period numbering (period 1 = horizon start), for the first `simulationPeriods`
 * periods. A loan almost never starts exactly on the horizon start, so its schedule
 * must be shifted by however many of its own periods had already elapsed by then, or
 * it's shown as if freshly originated years after it actually rolled onto a different
 * rate/payment. Simulation periods before the loan starts, or after it's already been
 * fully repaid, are simply absent (no debt payment) rather than incorrectly reusing the
 * loan's early/nonexistent periods. */
export function alignLoanScheduleToSimulation<T extends { period: number }>(
  loanSchedule: readonly T[],
  loanPeriodOffset: number,
  simulationPeriods: number,
): T[] {
  const result: T[] = [];
  for (let simulationPeriod = 1; simulationPeriod <= simulationPeriods; simulationPeriod++) {
    const loanPeriod = simulationPeriod + loanPeriodOffset;
    const entry = loanSchedule[loanPeriod - 1];
    if (loanPeriod < 1 || entry === undefined) continue;
    result.push({ ...entry, period: simulationPeriod });
  }
  return result;
}

/** Converts income records to simulation input items, in the selected base currency,
 * scoped to accounts still active. */
export async function buildSimulationIncomeItems(
  incomes: readonly Income[],
  activeAccountIds: ReadonlySet<string>,
  currency: string,
): Promise<SimulationIncomeItem[]> {
  return Promise.all(
    incomes
      .filter((i) => activeAccountIds.has(i.accountId))
      .map(async (i) => ({
        id: i.id,
        accountId: i.accountId,
        amount: await convertMoneyToCurrency(i.amount, currency),
        frequency: i.frequency,
        startDate: i.startDate,
        ...(i.endDate !== undefined ? { endDate: i.endDate } : {}),
        ...(i.inflationRule !== undefined ? { inflationRule: i.inflationRule } : {}),
      })),
  );
}

/** Converts expense records to simulation input items — see buildSimulationIncomeItems. */
export async function buildSimulationExpenseItems(
  expenses: readonly Expense[],
  activeAccountIds: ReadonlySet<string>,
  currency: string,
): Promise<SimulationExpenseItem[]> {
  return Promise.all(
    expenses
      .filter((e) => activeAccountIds.has(e.accountId))
      .map(async (e) => ({
        id: e.id,
        accountId: e.accountId,
        amount: await convertMoneyToCurrency(e.amount, currency),
        frequency: e.frequency,
        startDate: e.startDate,
        ...(e.endDate !== undefined ? { endDate: e.endDate } : {}),
        ...(e.inflationRule !== undefined ? { inflationRule: e.inflationRule } : {}),
      })),
  );
}

/** Converts active accounts to simulation input accounts, in the selected base currency. */
export async function buildSimulationAccounts(
  activeAccounts: readonly Account[],
  currency: string,
): Promise<{ accountId: string; initialBalance: Awaited<ReturnType<typeof convertMoneyToCurrency>>; minimumReserve: Awaited<ReturnType<typeof convertMoneyToCurrency>> }[]> {
  return Promise.all(
    activeAccounts.map(async (a) => ({
      accountId: a.id,
      initialBalance: await convertMoneyToCurrency(a.initialBalance, currency),
      minimumReserve: await convertMoneyToCurrency(a.minimumReserve, currency),
    })),
  );
}

/**
 * Pure counterpart to `loadSimulationInputs` — builds a `SimulationInput` from
 * already-resolved accounts/incomes/expenses/loans instead of fetching live repo data,
 * so callers that need to simulate against a *reconstructed* (e.g. point-in-time
 * historical) data set can reuse the exact same currency-conversion/filtering/
 * loan-amortization logic `dashboardService.getDashboardData` uses for the live "today"
 * case. A loan whose rate data is missing (`MissingRateDataError`) is silently excluded
 * from `debtPayments` — same behavior as the dashboard's loanWarnings path, minus the
 * warning surfacing, which callers here have no UI to show.
 */
export async function buildSimulationInput(params: {
  accounts: readonly Account[];
  incomes: readonly Income[];
  expenses: readonly Expense[];
  loans: readonly Loan[];
  currency: CurrencyCode;
  horizonStart: IsoDate;
  numberOfPeriods: number;
  periodFrequency?: Frequency;
}): Promise<SimulationInput> {
  const { accounts, incomes, expenses, loans, currency, horizonStart, numberOfPeriods } = params;
  const periodFrequency = params.periodFrequency ?? "monthly";

  const activeAccounts = accounts.filter((a) => a.active);
  const activeAccountIds = new Set(activeAccounts.map((a) => a.id));

  const [incomeItems, expenseItems, simAccounts] = await Promise.all([
    buildSimulationIncomeItems(incomes, activeAccountIds, currency),
    buildSimulationExpenseItems(expenses, activeAccountIds, currency),
    buildSimulationAccounts(activeAccounts, currency),
  ]);

  const debtPayments: SimulationDebtPayment[] = [];
  for (const loan of loans) {
    if (!activeAccountIds.has(loan.sourceAccountId)) continue;
    try {
      const fullSchedule = getLoanSchedule(loan);
      const loanPeriodOffset = loan.startDate.monthsUntil(horizonStart);
      const schedule = alignLoanScheduleToSimulation(fullSchedule, loanPeriodOffset, numberOfPeriods);
      for (const entry of schedule) {
        debtPayments.push({
          accountId: loan.sourceAccountId,
          period: entry.period,
          amount: await convertMoneyToCurrency(entry.totalCashOutflow, currency),
          loanId: loan.id,
        });
      }
    } catch (error) {
      if (!(error instanceof MissingRateDataError)) throw error;
    }
  }

  return {
    currency,
    accounts: simAccounts,
    incomeItems,
    expenseItems,
    debtPayments,
    events: [],
    horizonStart,
    periodFrequency,
    numberOfPeriods,
  };
}

/** Narrows raw simulation snapshots down to the {period, date, accounts} shape the
 * liquidity metrics (totalLiquidity, minimumLiquidity, liquidityRunway, ...) expect. */
export function toLiquiditySnapshots(snapshots: readonly SimulationPeriodSnapshot[]): PeriodLiquiditySnapshot[] {
  return snapshots.map((s) => ({
    period: s.period,
    date: s.date,
    accounts: s.accounts.map((a) => ({ accountId: a.accountId, balance: a.balance, minimumReserve: a.minimumReserve })),
  }));
}
