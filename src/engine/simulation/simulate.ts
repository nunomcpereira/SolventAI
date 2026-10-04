import { IsoDate } from "../dates/isoDate.js";
import { type Frequency, generatePeriodDates } from "../dates/frequency.js";
import { Money } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";
import { computeCashFlowPeriod } from "../cashflow/cashflow.js";
import { type SimulationEvent, orderEvents } from "./events.js";
import { expandOccurrences, type RecurringAmountItem } from "./recurringSchedule.js";

export interface SimulationAccountInput {
  accountId: string;
  initialBalance: Money;
  minimumReserve: Money;
}

export interface SimulationIncomeItem extends RecurringAmountItem {
  id: string;
  accountId: string;
}

export interface SimulationExpenseItem extends RecurringAmountItem {
  id: string;
  accountId: string;
}

/**
 * A scheduled debt-service cash outflow for one account in one period, precomputed by
 * the caller from a loan's amortization schedule (see engine/amortization,
 * engine/prepayment). This module owns account-level cash orchestration and event
 * application, not loan math — keeping the single authoritative amortization
 * implementation in one place.
 */
export interface SimulationDebtPayment {
  accountId: string;
  period: number;
  amount: Money;
  /** Effective annual interest rate for this payment, as a percentage (e.g. 4.595), for display alongside the payment amount. */
  ratePercent?: number;
  /** Which loan this payment belongs to, for per-loan breakdowns — optional since some
   * callers (tests, ad-hoc simulations) supply debt payments with no loan of record. */
  loanId?: string;
}

export interface SimulationInput {
  currency: CurrencyCode;
  accounts: SimulationAccountInput[];
  incomeItems: SimulationIncomeItem[];
  expenseItems: SimulationExpenseItem[];
  debtPayments?: SimulationDebtPayment[];
  events: SimulationEvent[];
  /** Simulation start date. Period 1 covers [horizonStart, horizonStart + 1 periodFrequency). */
  horizonStart: IsoDate;
  periodFrequency: Frequency;
  numberOfPeriods: number;
}

export interface SimulationAccountSnapshot {
  accountId: string;
  balance: Money;
  minimumReserve: Money;
}

export interface SimulationIncomeBreakdownEntry {
  itemId: string;
  accountId: string;
  amount: Money;
}

export interface SimulationExpenseBreakdownEntry {
  itemId: string;
  accountId: string;
  amount: Money;
}

export interface SimulationDebtBreakdownEntry {
  loanId: string;
  accountId: string;
  amount: Money;
}

export interface SimulationPeriodSnapshot {
  period: number;
  date: IsoDate;
  accounts: SimulationAccountSnapshot[];
  /** Events applied during this period, in the canonical deterministic order. */
  appliedEvents: SimulationEvent[];
  /** Sum across all accounts of recurring + one-time income for this period. */
  totalIncome: Money;
  /** Per-recurring-income-item amount that occurred this period (excludes one-time income events). */
  incomeBreakdown: SimulationIncomeBreakdownEntry[];
  /** Sum across all accounts of recurring + one-time living expenses for this period. */
  totalExpenses: Money;
  /** Per-recurring-expense-item amount that occurred this period (excludes one-time expense events). */
  expenseBreakdown: SimulationExpenseBreakdownEntry[];
  /** Sum across all accounts of scheduled loan debt-service payments for this period. */
  totalDebtService: Money;
  /** Per-loan debt-service payment for this period. */
  debtBreakdown: SimulationDebtBreakdownEntry[];
  /** Debt-service-weighted average effective annual rate across loans paying this period, if any carry a rate. */
  debtServiceRatePercent?: number;
}

/**
 * Runs a scenario period by period, producing one snapshot per period. Each period:
 *  1. Events due within the period window are applied in canonical order (see
 *     engine/simulation/events.ts) — "rate_change" is recorded in `appliedEvents` for
 *     the caller to react to (e.g. regenerate a loan schedule) but does not itself
 *     move money; "prepayment" event amounts must already include any penalty (the
 *     caller computes that via engine/prepayment.computePrepaymentPenalty before
 *     constructing the event, since this module has no loan-penalty-rule data).
 *  2. Income/expense occurrences for the period are computed via `expandOccurrences`,
 *     using any income_change/expense_change override in effect. An override applies
 *     for the remainder of the period it's declared in, and every period after — or,
 *     when it carries an `endDate`, every period starting on or before that date —
 *     event timing is period-granular, not sub-period-granular, matching the
 *     simulation's own resolution.
 *  3. Each account's period is closed via the single authoritative
 *     `computeCashFlowPeriod` formula (engine/cashflow) — no other arithmetic here.
 * A `balance_override` event replaces that account's opening cash for the period
 * (an absolute reset), overriding whatever the prior period's closing balance was.
 */
export function runSimulation(input: SimulationInput): SimulationPeriodSnapshot[] {
  if (input.numberOfPeriods <= 0 || !Number.isInteger(input.numberOfPeriods)) {
    throw new Error("runSimulation: numberOfPeriods must be a positive integer");
  }
  const currency = input.currency;
  const accountIds = input.accounts.map((a) => a.accountId);
  const minimumReserveByAccount = new Map(input.accounts.map((a) => [a.accountId, a.minimumReserve]));
  const runningBalance = new Map(input.accounts.map((a) => [a.accountId, a.initialBalance]));

  const incomeOverrides = new Map<string, { amount: Money; endDate: IsoDate | undefined }>();
  const expenseOverrides = new Map<string, { amount: Money; endDate: IsoDate | undefined }>();
  const debtPaymentsByPeriod = new Map<number, SimulationDebtPayment[]>();
  for (const dp of input.debtPayments ?? []) {
    const list = debtPaymentsByPeriod.get(dp.period) ?? [];
    list.push(dp);
    debtPaymentsByPeriod.set(dp.period, list);
  }

  const periodEndDates = generatePeriodDates(input.horizonStart, input.periodFrequency, input.numberOfPeriods);
  const snapshots: SimulationPeriodSnapshot[] = [];

  let periodStartInclusive = input.horizonStart;

  for (let p = 1; p <= input.numberOfPeriods; p++) {
    const periodEnd = periodEndDates[p - 1]!;
    // Half-open window [periodStartInclusive, periodEnd): an occurrence/event dated
    // exactly on a period boundary belongs to the period that STARTS there, not the
    // one that ends there — consistent between events and income/expense occurrences.
    const periodEndExclusive = periodEnd;

    const dueEvents = input.events.filter(
      (e) => e.date.isSameOrAfter(periodStartInclusive) && e.date.isBefore(periodEndExclusive),
    );
    const orderedDue = orderEvents(dueEvents);

    // A bounded override stops applying from the first period that starts after its endDate.
    for (const overrides of [incomeOverrides, expenseOverrides]) {
      for (const [itemId, override] of overrides) {
        if (override.endDate?.isBefore(periodStartInclusive)) overrides.delete(itemId);
      }
    }

    const overrideForAccount = new Map<string, Money>();
    const oneTimeIncomeByAccount = zeroPerAccount(accountIds, currency);
    const oneTimeExpenseByAccount = zeroPerAccount(accountIds, currency);
    const transfersInByAccount = zeroPerAccount(accountIds, currency);
    const transfersOutByAccount = zeroPerAccount(accountIds, currency);
    const prepaymentsByAccount = zeroPerAccount(accountIds, currency);

    for (const event of orderedDue) {
      const payload = event.payload;
      switch (payload.type) {
        case "balance_override":
          overrideForAccount.set(payload.accountId, payload.newBalance);
          break;
        case "rate_change":
          break; // recorded via appliedEvents only; loan-schedule reaction is the caller's responsibility.
        case "income_change":
          incomeOverrides.set(payload.incomeId, { amount: payload.newAmount, endDate: payload.endDate });
          break;
        case "expense_change":
          expenseOverrides.set(payload.expenseId, { amount: payload.newAmount, endDate: payload.endDate });
          break;
        case "one_time_income":
          addTo(oneTimeIncomeByAccount, payload.accountId, payload.amount);
          break;
        case "account_transfer":
          addTo(transfersOutByAccount, payload.fromAccountId, payload.amount);
          addTo(transfersInByAccount, payload.toAccountId, payload.creditedAmount);
          break;
        case "prepayment":
          addTo(prepaymentsByAccount, payload.sourceAccountId, payload.amount);
          break;
        case "one_time_expense":
          addTo(oneTimeExpenseByAccount, payload.accountId, payload.amount);
          break;
        default: {
          const exhaustive: never = payload;
          throw new Error(`Unhandled simulation event payload: ${JSON.stringify(exhaustive)}`);
        }
      }
    }

    const incomeByAccount = zeroPerAccount(accountIds, currency);
    const incomeBreakdown: SimulationIncomeBreakdownEntry[] = [];
    for (const item of input.incomeItems) {
      const amount = incomeOverrides.get(item.id)?.amount ?? item.amount;
      const occurrences = expandOccurrences({ ...item, amount }, periodStartInclusive, periodEndExclusive.addDays(-1));
      let itemTotal: Money | undefined;
      for (const occ of occurrences) {
        addTo(incomeByAccount, item.accountId, occ.amount);
        itemTotal = itemTotal ? itemTotal.add(occ.amount) : occ.amount;
      }
      if (itemTotal !== undefined) {
        incomeBreakdown.push({ itemId: item.id, accountId: item.accountId, amount: itemTotal });
      }
    }

    const expenseByAccount = zeroPerAccount(accountIds, currency);
    const expenseBreakdown: SimulationExpenseBreakdownEntry[] = [];
    for (const item of input.expenseItems) {
      const amount = expenseOverrides.get(item.id)?.amount ?? item.amount;
      const occurrences = expandOccurrences({ ...item, amount }, periodStartInclusive, periodEndExclusive.addDays(-1));
      let itemTotal: Money | undefined;
      for (const occ of occurrences) {
        addTo(expenseByAccount, item.accountId, occ.amount);
        itemTotal = itemTotal ? itemTotal.add(occ.amount) : occ.amount;
      }
      if (itemTotal !== undefined) {
        expenseBreakdown.push({ itemId: item.id, accountId: item.accountId, amount: itemTotal });
      }
    }

    const debtPaymentsByAccount = zeroPerAccount(accountIds, currency);
    const periodDebtPayments = debtPaymentsByPeriod.get(p) ?? [];
    const debtBreakdown: SimulationDebtBreakdownEntry[] = [];
    for (const dp of periodDebtPayments) {
      if (dp.loanId === undefined) continue;
      const existing = debtBreakdown.find((entry) => entry.loanId === dp.loanId);
      if (existing) {
        debtBreakdown[debtBreakdown.indexOf(existing)] = { ...existing, amount: existing.amount.add(dp.amount) };
      } else {
        debtBreakdown.push({ loanId: dp.loanId, accountId: dp.accountId, amount: dp.amount });
      }
    }
    for (const dp of periodDebtPayments) {
      addTo(debtPaymentsByAccount, dp.accountId, dp.amount);
    }
    let rateWeightedSum = 0;
    let rateWeight = 0;
    for (const dp of periodDebtPayments) {
      if (dp.ratePercent === undefined) continue;
      const weight = Number(dp.amount.toDecimalString());
      rateWeightedSum += dp.ratePercent * weight;
      rateWeight += weight;
    }
    const debtServiceRatePercent = rateWeight > 0 ? rateWeightedSum / rateWeight : undefined;

    const accountSnapshots: SimulationAccountSnapshot[] = [];
    let totalIncome = Money.zero(currency);
    let totalExpenses = Money.zero(currency);
    let totalDebtService = Money.zero(currency);
    for (const accountId of accountIds) {
      const openingCash = overrideForAccount.get(accountId) ?? runningBalance.get(accountId)!;
      const periodIncome = incomeByAccount.get(accountId)!.add(oneTimeIncomeByAccount.get(accountId)!);
      const periodExpenses = expenseByAccount.get(accountId)!.add(oneTimeExpenseByAccount.get(accountId)!);
      const periodDebtService = debtPaymentsByAccount.get(accountId)!;
      const result = computeCashFlowPeriod({
        openingCash,
        income: periodIncome,
        transfersIn: transfersInByAccount.get(accountId)!,
        livingExpenses: periodExpenses,
        debtPayments: periodDebtService,
        fees: Money.zero(currency),
        prepayments: prepaymentsByAccount.get(accountId)!,
        transfersOut: transfersOutByAccount.get(accountId)!,
      });
      runningBalance.set(accountId, result.closingCash);
      accountSnapshots.push({
        accountId,
        balance: result.closingCash,
        minimumReserve: minimumReserveByAccount.get(accountId)!,
      });
      totalIncome = totalIncome.add(periodIncome);
      totalExpenses = totalExpenses.add(periodExpenses);
      totalDebtService = totalDebtService.add(periodDebtService);
    }

    snapshots.push({
      period: p,
      date: periodEnd,
      accounts: accountSnapshots,
      appliedEvents: orderedDue,
      totalIncome,
      incomeBreakdown,
      totalExpenses,
      expenseBreakdown,
      totalDebtService,
      debtBreakdown,
      ...(debtServiceRatePercent !== undefined ? { debtServiceRatePercent } : {}),
    });
    periodStartInclusive = periodEnd;
  }

  return snapshots;
}

function zeroPerAccount(accountIds: readonly string[], currency: CurrencyCode): Map<string, Money> {
  return new Map(accountIds.map((id) => [id, Money.zero(currency)]));
}

function addTo(map: Map<string, Money>, accountId: string, amount: Money): void {
  const current = map.get(accountId);
  if (current === undefined) {
    throw new Error(`runSimulation: unknown account "${accountId}" referenced by an event or item`);
  }
  map.set(accountId, current.add(amount));
}
