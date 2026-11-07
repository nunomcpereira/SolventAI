import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import { createSqliteScenarioRepository } from "../db/repositories/index.js";
import { getLoanSchedule, computeLoanPrepayment, MissingRateDataError, type IndexRateOverride } from "./loanService.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { Money } from "../../engine/money/money.js";
import { Decimal } from "../../engine/money/decimal.js";
import { runSimulation, type SimulationDebtPayment } from "../../engine/simulation/simulate.js";
import { type Scenario, type SimulationEvent, parseScenario } from "../../domain/scenarios/scenario.js";
import { totalLiquidity, availableLiquidity, minimumLiquidity, type PeriodLiquiditySnapshot } from "../../engine/metrics/liquidity.js";
import { computeEffortRate } from "../../engine/metrics/effortRate.js";
import { type SimulationProjectionPoint } from "./simulationService.js";
import { convertMoneyToCurrency } from "./exchangeRateService.js";
import {
  loadSimulationInputs,
  alignLoanScheduleToSimulation,
  buildSimulationIncomeItems,
  buildSimulationExpenseItems,
  buildSimulationAccounts,
  toLiquiditySnapshots,
} from "./simulationBuilders.js";
import { computeHistoricalProjection } from "./historyReplayService.js";

const HORIZON_MONTHS = 12;
/** Timeline navigation caps at 100 years out (offsets 0..1188 months) from HORIZON_START. */
export const MAX_TIMELINE_MONTH_OFFSET = 99 * HORIZON_MONTHS;

/**
 * Simulation period 1's calendar date — always the actual current date, computed
 * fresh on every call (never cached at module scope, since the server process
 * outlives a single day). This must track real "now", not a fixed epoch: an
 * account's stored balance is edited to reflect its CURRENT real-world value, so if
 * period 1 were some date in the past, every recurring income/expense that already
 * occurred between then and today would be simulated a second time on top of a
 * balance that already includes it — double-counting months of salary/rent that
 * already happened.
 */
function horizonStartToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * How many simulation periods (relative to HORIZON_START, i.e. simulation period 1)
 * have elapsed strictly before `date`. Never negative — a date before HORIZON_START
 * clamps to 0 (simulation period 1), since periods before the simulation starts don't
 * exist on this timeline.
 */
function simulationPeriodsElapsedBefore(date: IsoDate): number {
  return Math.max(IsoDate.fromString(horizonStartToday()).monthsUntil(date), 0);
}

/**
 * How many of a loan's OWN periods (loan period 1 = loan.startDate) have already
 * elapsed by the time the simulation's period 1 begins. Positive when the loan
 * originated before HORIZON_START (the common case — most loans predate whatever
 * "today" the simulation starts from), negative when it starts after. Every loan
 * schedule this file feeds into the simulation must be shifted by this amount, or a
 * loan that's already partway through its life gets shown as if it just began (e.g.
 * still "in" its fixed-rate period on the timeline years after it actually rolled
 * over to variable, because periods 1..N of a fresh getLoanSchedule() were mistaken
 * for the loan's CURRENT periods instead of its very first ones).
 */
function loanPeriodOffsetAtHorizonStart(loan: { startDate: IsoDate }): number {
  return loan.startDate.monthsUntil(IsoDate.fromString(horizonStartToday()));
}

export async function listScenarios(): Promise<Scenario[]> {
  const db = await getDb();
  await ensureSeeded(db);
  return createSqliteScenarioRepository(db).list();
}

export async function createScenario(name: string): Promise<Scenario> {
  const db = await getDb();
  const scenario = parseScenario({ id: randomUUID(), name, events: [] });
  await createSqliteScenarioRepository(db).save(scenario);
  return scenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const db = await getDb();
  await createSqliteScenarioRepository(db).delete(id);
}

async function addScenarioEvent(scenarioId: string, event: SimulationEvent): Promise<void> {
  const db = await getDb();
  const repo = createSqliteScenarioRepository(db);
  const scenario = await repo.findById(scenarioId);
  if (!scenario) throw new Error(`Scenario "${scenarioId}" not found`);
  await repo.save({ ...scenario, events: [...scenario.events, event] });
}

/** Blank form input means "no end date" (the change applies indefinitely). */
function optionalEndDate(raw: string | undefined): { endDate: IsoDate } | Record<string, never> {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? { endDate: IsoDate.fromString(trimmed) } : {};
}

/** Builds a `SimulationEvent`'s payload from raw string form input, shared by both the
 * add and update event flows so the two stay in sync. */
export function buildEventPayload(eventType: string, input: Record<string, string>): SimulationEvent["payload"] {
  switch (eventType) {
    case "one_time_expense":
      return { type: "one_time_expense", accountId: input.accountId ?? "", amount: Money.fromDecimalString(input.amount ?? "0", input.currency ?? "EUR") };
    case "one_time_income":
      return { type: "one_time_income", accountId: input.accountId ?? "", amount: Money.fromDecimalString(input.amount ?? "0", input.currency ?? "EUR") };
    case "income_change":
      return {
        type: "income_change",
        incomeId: input.incomeId ?? "",
        newAmount: Money.fromDecimalString(input.newAmount ?? "0", input.currency ?? "EUR"),
        ...optionalEndDate(input.endDate),
      };
    case "expense_change":
      return {
        type: "expense_change",
        expenseId: input.expenseId ?? "",
        newAmount: Money.fromDecimalString(input.newAmount ?? "0", input.currency ?? "EUR"),
        ...optionalEndDate(input.endDate),
      };
    case "prepayment":
      return {
        type: "prepayment",
        loanId: input.loanId ?? "",
        sourceAccountId: input.sourceAccountId ?? "",
        amount: Money.fromDecimalString(input.amount ?? "0", input.currency ?? "EUR"),
        strategy: input.strategy === "shorten_term" ? "shorten_term" : "reduce_payment",
      };
    case "rate_change":
      return {
        type: "rate_change",
        loanId: input.loanId ?? "",
        index: input.index ?? "",
        newAnnualValue: Decimal.fromString(input.newAnnualValuePercent ?? "0").div(Decimal.fromBigInt(100n)),
      };
    default:
      throw new Error(`Unknown scenario event type "${eventType}"`);
  }
}

function buildEvent(id: string, eventType: string, date: string, input: Record<string, string>): SimulationEvent {
  const eventDate = IsoDate.fromString(date);
  const payload = buildEventPayload(eventType, input);
  if ((payload.type === "income_change" || payload.type === "expense_change") && payload.endDate?.isBefore(eventDate)) {
    throw new Error("End date must not be before the event date");
  }
  return { id, date: eventDate, payload };
}

/** Adds a new event to `scenarioId`, built from raw form input via `buildEventPayload`. */
export async function addEvent(scenarioId: string, eventType: string, date: string, input: Record<string, string>): Promise<void> {
  await addScenarioEvent(scenarioId, buildEvent(randomUUID(), eventType, date, input));
}

/** Replaces an existing event's date/payload in place, keeping its id. */
export async function updateEvent(
  scenarioId: string,
  eventId: string,
  eventType: string,
  date: string,
  input: Record<string, string>,
): Promise<void> {
  const db = await getDb();
  const repo = createSqliteScenarioRepository(db);
  const scenario = await repo.findById(scenarioId);
  if (!scenario) throw new Error(`Scenario "${scenarioId}" not found`);
  const updated = buildEvent(eventId, eventType, date, input);
  await repo.save({ ...scenario, events: scenario.events.map((e) => (e.id === eventId ? updated : e)) });
}

export async function deleteEvent(scenarioId: string, eventId: string): Promise<void> {
  const db = await getDb();
  const repo = createSqliteScenarioRepository(db);
  const scenario = await repo.findById(scenarioId);
  if (!scenario) throw new Error(`Scenario "${scenarioId}" not found`);
  await repo.save({ ...scenario, events: scenario.events.filter((e) => e.id !== eventId) });
}

export async function addOneTimeExpenseEvent(
  scenarioId: string,
  input: { accountId: string; date: string; amount: string; currency: string },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "one_time_expense",
      accountId: input.accountId,
      amount: Money.fromDecimalString(input.amount, input.currency),
    },
  });
}

/** A cash deposit at a point in time — e.g. a bonus, gift, or windfall — increasing an account's balance. */
export async function addOneTimeIncomeEvent(
  scenarioId: string,
  input: { accountId: string; date: string; amount: string; currency: string },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "one_time_income",
      accountId: input.accountId,
      amount: Money.fromDecimalString(input.amount, input.currency),
    },
  });
}

/** Changes a recurring income's amount from a given date onward — e.g. a salary cut or
 * (set to 0) a period of unemployment. */
export async function addIncomeChangeEvent(
  scenarioId: string,
  input: { incomeId: string; date: string; newAmount: string; currency: string },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "income_change",
      incomeId: input.incomeId,
      newAmount: Money.fromDecimalString(input.newAmount, input.currency),
    },
  });
}

/** Changes a recurring expense's amount from a given date onward. */
export async function addExpenseChangeEvent(
  scenarioId: string,
  input: { expenseId: string; date: string; newAmount: string; currency: string },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "expense_change",
      expenseId: input.expenseId,
      newAmount: Money.fromDecimalString(input.newAmount, input.currency),
    },
  });
}

/** Changes a variable-rate loan's index value (e.g. "what if Euribor 6M becomes 5%")
 * from a given date onward — periods before that date keep using the loan's currently
 * stored index value. Only affects loans whose rate references `index`.
 * `newAnnualValuePercent` is a plain percentage (e.g. "5" for 5%), matching how the
 * rate is shown/entered in the UI; it's converted to the engine's fractional form. */
export async function addRateChangeEvent(
  scenarioId: string,
  input: { loanId: string; index: string; date: string; newAnnualValuePercent: string },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "rate_change",
      loanId: input.loanId,
      index: input.index,
      newAnnualValue: Decimal.fromString(input.newAnnualValuePercent).div(Decimal.fromBigInt(100n)),
    },
  });
}

/**
 * A lump-sum prepayment ("amortização") against a loan as of a given date. `amount` is
 * the PRINCIPAL the user wants to pay down — the loan's own prepayment penalty (if any)
 * is computed and added on top when this event's actual cash impact is simulated (see
 * runScenarioAgainstBase's normalizeEventMoney), and the loan's remaining schedule is
 * recomputed under `strategy` for every run that includes this event.
 */
export async function addPrepaymentEvent(
  scenarioId: string,
  input: { loanId: string; sourceAccountId: string; date: string; amount: string; currency: string; strategy: "reduce_payment" | "shorten_term" },
): Promise<void> {
  await addScenarioEvent(scenarioId, {
    id: randomUUID(),
    date: IsoDate.fromString(input.date),
    payload: {
      type: "prepayment",
      loanId: input.loanId,
      sourceAccountId: input.sourceAccountId,
      amount: Money.fromDecimalString(input.amount, input.currency),
      strategy: input.strategy,
    },
  });
}

export interface ScenarioLiquidityImpact {
  availableLiquidityNow: string;
  projectedMinimumLiquidity: string;
}

export interface ScenarioRunResult {
  currency: string;
  accountIds: string[];
  monthOffset: number;
  /** Most negative `monthOffset` the timeline can be paged back to — bounded by the
   * earliest active account's creation date (0 when there's no history to replay). */
  minMonthOffset: number;
  /** ISO date of the first and last month in the currently displayed 12-month window. */
  windowStartDate: string;
  windowEndDate: string;
  baseProjection: SimulationProjectionPoint[];
  scenarioProjection: SimulationProjectionPoint[];
  /** Sparse real-balance checkpoints (see historyReplayService.computeHistoricalProjection)
   * falling inside the displayed window — empty wherever the window is entirely in the
   * future, since there's nothing "actual" to show yet. */
  actualLiquidity: { date: string; totalLiquidity: string }[];
  baseImpact: ScenarioLiquidityImpact;
  scenarioImpact: ScenarioLiquidityImpact;
  /**
   * Default effort rate (spec section 17) shown before the user hovers a specific
   * period on the chart — the active (scenario, or base if none selected) projection's
   * first period. Each `SimulationProjectionPoint` also carries its own
   * `effortRatePercent`, which the UI switches to live on hover.
   */
  effortRatePercent: string | undefined;
}

/**
 * Runs the immutable base scenario (no events) alongside `scenario`'s own events layered
 * on top. `monthOffset` (minMonthOffset..MAX_TIMELINE_MONTH_OFFSET, clamped) slides a
 * 12-month window across the timeline — 0 shows the next 12 months from today, 1 shifts
 * the window forward by a single month, -1 shifts it one month into the past, etc.
 * Negative offsets are served from `computeHistoricalProjection` (a replay of the
 * config that actually stood at each point in time) rather than a forward simulation —
 * see that function's docs. The forward simulation itself always runs from period 1
 * (today) up through the end of the selected window when the window reaches into the
 * future, since later periods depend on carried-forward balances and amortization
 * progress; only the final 12 periods of the combined past+future timeline are returned.
 */
export async function runScenarioAgainstBase(
  scenario: Scenario | undefined,
  monthOffset = 0,
): Promise<ScenarioRunResult> {
  const historical = await computeHistoricalProjection();
  const minMonthOffset = historical.projected.length > 0 ? -historical.projected.length : 0;
  const clampedMonthOffset = Math.min(Math.max(Math.trunc(monthOffset), minMonthOffset), MAX_TIMELINE_MONTH_OFFSET);
  const totalMonths = Math.max(clampedMonthOffset, 0) + HORIZON_MONTHS;

  const { loans, incomes, expenses, currency, activeAccounts, activeAccountIds } = await loadSimulationInputs();
  const loanIds = new Set(loans.map((l) => l.id));
  const incomeIds = new Set(incomes.map((i) => i.id));
  const expenseIds = new Set(expenses.map((e) => e.id));

  /**
   * Builds each loan's debt-service schedule for this run, re-indexed onto the
   * simulation's own period numbering (see alignLoanScheduleToSimulation — a loan
   * almost never originates exactly on HORIZON_START, so its schedule has to be
   * shifted by however many of its own periods had already elapsed by then). If
   * `rawEvents` (the scenario's own un-normalized events — see normalizeEventMoney)
   * contains a "prepayment" targeting a loan, that loan's remaining schedule is
   * recomputed via computeLoanPrepayment (smaller payments or a shorter term, per the
   * event's strategy) instead of using its original, unmodified schedule. Only the
   * first prepayment event per loan (by array order) is applied — layering multiple
   * prepayments on the same loan isn't supported yet.
   */
  const buildDebtPayments = async (
    rawEvents: SimulationEvent[],
  ): Promise<{
    payments: SimulationDebtPayment[];
    outstandingByPeriod: Map<number, Money>;
    outstandingByLoanAndPeriod: Map<string, Map<number, Money>>;
  }> => {
    const debtPayments: SimulationDebtPayment[] = [];
    const outstandingByPeriod = new Map<number, Money>();
    const outstandingByLoanAndPeriod = new Map<string, Map<number, Money>>();
    for (const loan of loans) {
      if (!activeAccountIds.has(loan.sourceAccountId)) continue;
      try {
        const loanPeriodOffset = loanPeriodOffsetAtHorizonStart(loan);
        const prepaymentEvent = rawEvents.find(
          (e) => e.payload.type === "prepayment" && e.payload.loanId === loan.id,
        );
        const rateChangeEvent = rawEvents.find(
          (e) => e.payload.type === "rate_change" && e.payload.loanId === loan.id,
        );
        const indexRateOverride: IndexRateOverride | undefined =
          rateChangeEvent && rateChangeEvent.payload.type === "rate_change"
            ? {
                index: rateChangeEvent.payload.index,
                fromPeriod: loanPeriodOffset + simulationPeriodsElapsedBefore(rateChangeEvent.date) + 1,
                newAnnualValue: rateChangeEvent.payload.newAnnualValue,
              }
            : undefined;
        const fullLoanSchedule =
          prepaymentEvent && prepaymentEvent.payload.type === "prepayment"
            ? computeLoanPrepayment(loan, {
                periodsElapsed: loanPeriodOffset + simulationPeriodsElapsedBefore(prepaymentEvent.date),
                prepaymentAmount: prepaymentEvent.payload.amount,
                strategy: prepaymentEvent.payload.strategy,
                ...(indexRateOverride ? { indexRateOverride } : {}),
              }).newSchedule
            : getLoanSchedule(loan, undefined, indexRateOverride);
        const schedule = alignLoanScheduleToSimulation(fullLoanSchedule, loanPeriodOffset, totalMonths);
        const outstandingByPeriodForLoan = new Map<number, Money>();
        for (const entry of schedule) {
          debtPayments.push({
            accountId: loan.sourceAccountId,
            period: entry.period,
            amount: await convertMoneyToCurrency(entry.totalCashOutflow, currency),
            ratePercent: Number(entry.rate.toString()) * 100,
            loanId: loan.id,
          });
          const closingPrincipal = await convertMoneyToCurrency(entry.closingPrincipal, currency);
          outstandingByPeriod.set(entry.period, (outstandingByPeriod.get(entry.period) ?? Money.zero(currency)).add(closingPrincipal));
          outstandingByPeriodForLoan.set(entry.period, closingPrincipal);
        }
        outstandingByLoanAndPeriod.set(loan.id, outstandingByPeriodForLoan);
      } catch (error) {
        if (!(error instanceof MissingRateDataError)) throw error;
      }
    }
    return { payments: debtPayments, outstandingByPeriod, outstandingByLoanAndPeriod };
  };
  const baseDebtPayments = await buildDebtPayments([]);

  const incomeItems = await buildSimulationIncomeItems(incomes, activeAccountIds, currency);
  const expenseItems = await buildSimulationExpenseItems(expenses, activeAccountIds, currency);
  const baseAccounts = await buildSimulationAccounts(activeAccounts, currency);

  async function normalizeEventMoney(event: SimulationEvent): Promise<SimulationEvent> {
    const payload = event.payload;
    switch (payload.type) {
      case "balance_override":
        return {
          ...event,
          payload: { ...payload, newBalance: await convertMoneyToCurrency(payload.newBalance, currency) },
        };
      case "income_change":
        return {
          ...event,
          payload: { ...payload, newAmount: await convertMoneyToCurrency(payload.newAmount, currency) },
        };
      case "expense_change":
        return {
          ...event,
          payload: { ...payload, newAmount: await convertMoneyToCurrency(payload.newAmount, currency) },
        };
      case "one_time_income":
        return {
          ...event,
          payload: { ...payload, amount: await convertMoneyToCurrency(payload.amount, currency) },
        };
      case "account_transfer":
        return {
          ...event,
          payload: {
            ...payload,
            amount: await convertMoneyToCurrency(payload.amount, currency),
            creditedAmount: await convertMoneyToCurrency(payload.creditedAmount, currency),
          },
        };
      case "prepayment": {
        // payload.amount is stored as the PRINCIPAL the user wants to pay down; the
        // actual one-time cash outflow (fed to the engine's account cash flow) also
        // includes the loan's own prepayment penalty, if any.
        const loan = loans.find((l) => l.id === payload.loanId);
        if (!loan) {
          return { ...event, payload: { ...payload, amount: await convertMoneyToCurrency(payload.amount, currency) } };
        }
        const { totalCashOutflow } = computeLoanPrepayment(loan, {
          periodsElapsed: loanPeriodOffsetAtHorizonStart(loan) + simulationPeriodsElapsedBefore(event.date),
          prepaymentAmount: payload.amount,
          strategy: payload.strategy,
        });
        return { ...event, payload: { ...payload, amount: await convertMoneyToCurrency(totalCashOutflow, currency) } };
      }
      case "one_time_expense":
        return {
          ...event,
          payload: { ...payload, amount: await convertMoneyToCurrency(payload.amount, currency) },
        };
      case "rate_change":
        return event;
      default: {
        const exhaustive: never = payload;
        return { ...event, payload: exhaustive };
      }
    }
  }

  const isValidEvent = (event: SimulationEvent): boolean => {
    switch (event.payload.type) {
      case "balance_override":
      case "one_time_income":
      case "one_time_expense":
        return activeAccountIds.has(event.payload.accountId);
      case "account_transfer":
        return activeAccountIds.has(event.payload.fromAccountId) && activeAccountIds.has(event.payload.toAccountId);
      case "prepayment":
        return loanIds.has(event.payload.loanId) && activeAccountIds.has(event.payload.sourceAccountId);
      case "income_change":
        return incomeIds.has(event.payload.incomeId);
      case "expense_change":
        return expenseIds.has(event.payload.expenseId);
      case "rate_change":
        return loanIds.has(event.payload.loanId);
      default:
        return false;
    }
  };

  const runOnce = (
    events: SimulationEvent[],
    debtPaymentsForRun: {
      payments: SimulationDebtPayment[];
      outstandingByPeriod: Map<number, Money>;
      outstandingByLoanAndPeriod: Map<string, Map<number, Money>>;
    },
  ): { fullProjection: SimulationProjectionPoint[]; impact: ScenarioLiquidityImpact } => {
    if (activeAccounts.length === 0) {
      const zero = Money.zero(currency).toDecimalString();
      return { fullProjection: [], impact: { availableLiquidityNow: zero, projectedMinimumLiquidity: zero } };
    }
    const snapshots = runSimulation({
      currency,
      accounts: baseAccounts,
      incomeItems,
      expenseItems,
      debtPayments: debtPaymentsForRun.payments,
      events: events.filter(isValidEvent),
      horizonStart: IsoDate.fromString(horizonStartToday()),
      periodFrequency: "monthly",
      numberOfPeriods: totalMonths,
    });
    const liquiditySnapshots = toLiquiditySnapshots(snapshots);
    // Every simulated period is mapped (not just the requested window) — the caller
    // stitches this onto the historical replay and slices out whichever 12-month window
    // was requested, which may land anywhere across the combined past+future timeline.
    const fullProjection = snapshots.map((snap, index) => ({
      month: snap.period,
      monthInYear: index + 1,
      date: snap.date.toString(),
      totalLiquidity: totalLiquidity(currency, liquiditySnapshots[index]!).toDecimalString(),
      totalIncome: snap.totalIncome.toDecimalString(),
      incomeComponents: snap.incomeBreakdown.map((c) => ({ itemId: c.itemId, accountId: c.accountId, amount: c.amount.toDecimalString() })),
      totalExpenses: snap.totalExpenses.toDecimalString(),
      expenseComponents: snap.expenseBreakdown.map((c) => ({ itemId: c.itemId, accountId: c.accountId, amount: c.amount.toDecimalString() })),
      totalDebtService: snap.totalDebtService.toDecimalString(),
      debtComponents: snap.debtBreakdown.map((c) => ({
        loanId: c.loanId,
        accountId: c.accountId,
        amount: c.amount.toDecimalString(),
        outstanding: (debtPaymentsForRun.outstandingByLoanAndPeriod.get(c.loanId)?.get(snap.period) ?? Money.zero(currency)).toDecimalString(),
      })),
      totalOutstandingDebt: (debtPaymentsForRun.outstandingByPeriod.get(snap.period) ?? Money.zero(currency)).toDecimalString(),
      ...(snap.debtServiceRatePercent !== undefined ? { debtServiceRatePercent: snap.debtServiceRatePercent } : {}),
      ...(snap.totalIncome.isPositive()
        ? { effortRatePercent: computeEffortRate(snap.totalDebtService, snap.totalIncome).toString() }
        : {}),
      accountBalances: snap.accounts.map((a) => ({ accountId: a.accountId, balance: a.balance.toDecimalString() })),
    }));
    // Impact figures always reflect the forward run's own 12-month window (today onward)
    // regardless of which past/future window is being displayed on the chart.
    const windowLiquiditySnapshots = liquiditySnapshots.slice(totalMonths - HORIZON_MONTHS, totalMonths);
    const firstEverSnapshot: PeriodLiquiditySnapshot = {
      period: snapshots[0]!.period,
      date: snapshots[0]!.date,
      accounts: snapshots[0]!.accounts.map((a) => ({ accountId: a.accountId, balance: a.balance, minimumReserve: a.minimumReserve })),
    };
    const impact: ScenarioLiquidityImpact = {
      // "Now" always reflects period 1 (today), regardless of which window is being viewed.
      availableLiquidityNow: availableLiquidity(currency, firstEverSnapshot).toDecimalString(),
      projectedMinimumLiquidity: minimumLiquidity(currency, windowLiquiditySnapshots).toDecimalString(),
    };
    return { fullProjection, impact };
  };

  const base = runOnce([], baseDebtPayments);
  const normalizedScenarioEvents = scenario ? await Promise.all(scenario.events.map(normalizeEventMoney)) : undefined;
  const scenarioDebtPayments = scenario ? await buildDebtPayments(scenario.events) : baseDebtPayments;
  const scenarioRun = normalizedScenarioEvents ? runOnce(normalizedScenarioEvents, scenarioDebtPayments) : base;

  // Stitch the historical replay (dates before today, identical for base/scenario since
  // scenario events aren't replayed retroactively) onto each forward run, then slice out
  // the requested 12-month window — which may land entirely in the past, straddle today,
  // or be entirely in the future, symmetrically with the existing forward-only behavior.
  const windowStartIndex = historical.projected.length + clampedMonthOffset;
  const reindex = (points: SimulationProjectionPoint[]): SimulationProjectionPoint[] =>
    points.map((p, i) => ({ ...p, month: i + 1, monthInYear: i + 1 }));
  const baseProjection = reindex([...historical.projected, ...base.fullProjection].slice(windowStartIndex, windowStartIndex + HORIZON_MONTHS));
  // No scenario selected — reuse the very same array (not just equal content) so the UI's
  // `scenario !== base` reference check still correctly collapses to a single column.
  const scenarioProjection =
    scenarioRun === base
      ? baseProjection
      : reindex([...historical.projected, ...scenarioRun.fullProjection].slice(windowStartIndex, windowStartIndex + HORIZON_MONTHS));

  // Each period on the (base or scenario) projection now carries its own effortRatePercent
  // (see the map building `fullProjection` above) — the displayed year's default is that
  // of the window's first period, and the UI updates it live as the user hovers other months.
  const activeProjection = scenarioProjection.length > 0 ? scenarioProjection : baseProjection;
  const effortRatePercent = activeProjection[0]?.effortRatePercent;

  const windowStartDate = baseProjection[0]?.date ?? IsoDate.fromString(horizonStartToday()).toString();
  const windowEndDate = baseProjection[baseProjection.length - 1]?.date ?? IsoDate.fromString(horizonStartToday()).toString();
  const actualLiquidity = historical.actual.filter((a) => a.date >= windowStartDate && a.date <= windowEndDate);

  return {
    currency,
    accountIds: activeAccounts.map((a) => a.id),
    monthOffset: clampedMonthOffset,
    minMonthOffset,
    windowStartDate,
    windowEndDate,
    baseProjection,
    scenarioProjection,
    actualLiquidity,
    baseImpact: base.impact,
    scenarioImpact: scenarioRun.impact,
    effortRatePercent,
  };
}
