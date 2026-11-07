import { IsoDate } from "../dates/isoDate.js";
import { Money, sumMoney } from "../money/money.js";
import { type CurrencyCode } from "../money/currency.js";

/**
 * All balances/reserves here must already be in the same currency (the simulation's
 * base currency) — conversion happens upstream (spec section 6). This module never
 * aggregates across currencies.
 */
export interface AccountLiquiditySnapshot {
  accountId: string;
  balance: Money;
  minimumReserve: Money;
}

export interface PeriodLiquiditySnapshot {
  period: number;
  date: IsoDate;
  accounts: AccountLiquiditySnapshot[];
}

/** Total cash across all accounts (spec section 16, "Total liquidity"). */
export function totalLiquidity(currency: CurrencyCode, snapshot: PeriodLiquiditySnapshot): Money {
  return sumMoney(currency, snapshot.accounts.map((a) => a.balance));
}

/**
 * Solvency risk: 100% once the balance is negative (or non-positive with no debt to
 * offset it), 0% once the balance covers the total outstanding debt, and ramping
 * linearly between those — so a positive balance trending down toward zero shows
 * rising risk period over period, without needing to look at multiple periods at
 * once (each period's risk is a pure function of that period's balance vs. debt).
 */
export function computeSolvencyRisk(balance: number, debt: number): number {
  if (balance <= 0) return 100;
  if (debt <= 0 || balance >= debt) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - balance / debt)));
}

/**
 * Liquidity above configured minimum reserves (spec section 16, "Available
 * liquidity"), computed in aggregate: sum(balances) - sum(minimumReserves). A single
 * account below its own reserve while another is well above it will not show up here
 * — use `findAccountReserveBreaches` for that per-account view.
 */
export function availableLiquidity(currency: CurrencyCode, snapshot: PeriodLiquiditySnapshot): Money {
  const totalReserve = sumMoney(currency, snapshot.accounts.map((a) => a.minimumReserve));
  return totalLiquidity(currency, snapshot).sub(totalReserve);
}

/** Accounts whose balance has fallen below their own configured minimum reserve. */
export function findAccountReserveBreaches(snapshot: PeriodLiquiditySnapshot): AccountLiquiditySnapshot[] {
  return snapshot.accounts.filter((a) => a.balance.compare(a.minimumReserve) < 0);
}

/**
 * First period (by array index) at which aggregate available liquidity goes negative,
 * i.e. the liquidity runway in periods. Returns undefined if it never breaches within
 * the given horizon (spec section 16, "Liquidity runway").
 */
export function liquidityRunway(currency: CurrencyCode, periods: readonly PeriodLiquiditySnapshot[]): number | undefined {
  for (let i = 0; i < periods.length; i++) {
    if (availableLiquidity(currency, periods[i]!).isNegative()) {
      return i;
    }
  }
  return undefined;
}

/** Lowest projected available liquidity across the whole simulation (spec section 16, "Minimum liquidity"). */
export function minimumLiquidity(currency: CurrencyCode, periods: readonly PeriodLiquiditySnapshot[]): Money {
  if (periods.length === 0) {
    throw new Error("minimumLiquidity: periods must not be empty");
  }
  return periods.reduce(
    (min, snapshot) => min.min(availableLiquidity(currency, snapshot)),
    availableLiquidity(currency, periods[0]!),
  );
}

export interface LiquidityBreachEvent {
  period: number;
  date: IsoDate;
  /** "global" = aggregate available liquidity negative; "account" = a single account below its own reserve. */
  scope: "global" | "account";
  accountId?: string;
}

/** All liquidity-breach events across the horizon (spec section 16, "Liquidity breach"). */
export function findLiquidityBreaches(
  currency: CurrencyCode,
  periods: readonly PeriodLiquiditySnapshot[],
): LiquidityBreachEvent[] {
  const events: LiquidityBreachEvent[] = [];
  for (const snapshot of periods) {
    if (availableLiquidity(currency, snapshot).isNegative()) {
      events.push({ period: snapshot.period, date: snapshot.date, scope: "global" });
    }
    for (const breach of findAccountReserveBreaches(snapshot)) {
      events.push({ period: snapshot.period, date: snapshot.date, scope: "account", accountId: breach.accountId });
    }
  }
  return events;
}
