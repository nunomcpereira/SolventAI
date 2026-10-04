import "server-only";
import { randomUUID } from "node:crypto";
import { Money } from "../../engine/money/money.js";
import { Decimal } from "../../engine/money/decimal.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { findApplicableRate, parseExchangeRate } from "../../domain/exchangeRates/exchangeRate.js";
import { getDb } from "./db.js";
import { createSqliteExchangeRateRepository } from "../db/repositories/index.js";

interface FrankfurterLatestResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

function todayIsoDate(): IsoDate {
  return IsoDate.fromString(new Date().toISOString().slice(0, 10));
}

async function fetchLiveRate(fromCurrency: string, toCurrency: string): Promise<{ rate: Decimal; effectiveDate: IsoDate }> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch live FX rate (${response.status} ${response.statusText})`);
  }

  const payload = (await response.json()) as FrankfurterLatestResponse;
  const numericRate = payload.rates?.[to];
  if (typeof numericRate !== "number" || !Number.isFinite(numericRate) || numericRate <= 0) {
    throw new Error(`Live FX response missing usable ${from}->${to} rate`);
  }

  return {
    rate: Decimal.fromString(String(numericRate)),
    effectiveDate: IsoDate.fromString(payload.date),
  };
}

async function resolveRate(fromCurrency: string, toCurrency: string, asOfDate: IsoDate): Promise<Decimal> {
  if (fromCurrency === toCurrency) return Decimal.ONE;

  const db = await getDb();
  const repo = createSqliteExchangeRateRepository(db);
  const rates = await repo.list();

  const direct = findApplicableRate(rates, fromCurrency, toCurrency, asOfDate);
  if (direct) return direct.rate;

  const inverse = findApplicableRate(rates, toCurrency, fromCurrency, asOfDate);
  if (inverse) return Decimal.ONE.div(inverse.rate);

  const live = await fetchLiveRate(fromCurrency, toCurrency);
  await repo.save(
    parseExchangeRate({
      id: randomUUID(),
      fromCurrency,
      toCurrency,
      rate: live.rate.toString(),
      effectiveDate: live.effectiveDate.toString(),
    }),
  );

  return live.rate;
}

export async function convertMoneyToCurrency(
  amount: Money,
  toCurrency: string,
  asOfDate: IsoDate = todayIsoDate(),
): Promise<Money> {
  const from = amount.currency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;

  const rate = await resolveRate(from, to, asOfDate);
  return Money.fromMinorUnits(amount.mulDecimal(rate).minorUnits, to);
}
