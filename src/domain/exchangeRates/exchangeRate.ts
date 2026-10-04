import { z } from "zod";
import { Decimal } from "../../engine/money/decimal.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import {
  currencyCodeSchema,
  decimalSchema,
  decimalToSerialized,
  decimalFromSerialized,
  isoDateSchema,
  isoDateToSerialized,
  isoDateFromSerialized,
  type SerializedDecimal,
  type SerializedIsoDate,
  DomainValidationError,
  type Repository,
} from "../shared/index.js";

/**
 * A user-provided FX rate observation (spec section 6): local data only, no online
 * dependency. `rate` converts 1 unit of `fromCurrency` into `rate` units of
 * `toCurrency`, effective from `effectiveDate` until superseded by a later one.
 */
export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: Decimal;
  effectiveDate: IsoDate;
}

export interface ExchangeRateRepository extends Repository<ExchangeRate> {}

export const exchangeRateInputSchema = z
  .object({
    id: z.string().min(1),
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: decimalSchema,
    effectiveDate: isoDateSchema,
  })
  .refine((v) => v.fromCurrency !== v.toCurrency, {
    message: "fromCurrency and toCurrency must differ",
    path: ["toCurrency"],
  });
export type ExchangeRateInput = z.infer<typeof exchangeRateInputSchema>;

export interface SerializedExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: SerializedDecimal;
  effectiveDate: SerializedIsoDate;
}

export function parseExchangeRate(raw: unknown): ExchangeRate {
  const result = exchangeRateInputSchema.safeParse(raw);
  if (!result.success) {
    throw new DomainValidationError("ExchangeRate", result.error);
  }
  const input = result.data;
  const rate = decimalFromSerialized(input.rate);
  if (rate.isZero() || rate.isNegative()) {
    throw new DomainValidationError(
      "ExchangeRate",
      new z.ZodError([{ code: "custom", path: ["rate"], message: "must be positive" }]),
    );
  }

  return {
    id: input.id,
    fromCurrency: input.fromCurrency,
    toCurrency: input.toCurrency,
    rate,
    effectiveDate: isoDateFromSerialized(input.effectiveDate),
  };
}

export function serializeExchangeRate(exchangeRate: ExchangeRate): SerializedExchangeRate {
  return {
    id: exchangeRate.id,
    fromCurrency: exchangeRate.fromCurrency,
    toCurrency: exchangeRate.toCurrency,
    rate: decimalToSerialized(exchangeRate.rate),
    effectiveDate: isoDateToSerialized(exchangeRate.effectiveDate),
  };
}

/**
 * Finds the applicable rate for `fromCurrency` -> `toCurrency` on `asOfDate`: the most
 * recent rate with effectiveDate <= asOfDate. Returns undefined (never invents a rate)
 * when none exists — callers must treat that as an explicit missing-data error per
 * spec section 6, not silently skip the conversion.
 */
export function findApplicableRate(
  rates: readonly ExchangeRate[],
  fromCurrency: string,
  toCurrency: string,
  asOfDate: IsoDate,
): ExchangeRate | undefined {
  const matching = rates
    .filter((r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency && r.effectiveDate.isSameOrBefore(asOfDate))
    .sort((a, b) => b.effectiveDate.compare(a.effectiveDate));
  return matching[0];
}
