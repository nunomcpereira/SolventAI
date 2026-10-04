import { z } from "zod";
import { Money } from "../../engine/money/money.js";
import { minorUnitExponent } from "../../engine/money/currency.js";
import { Decimal } from "../../engine/money/decimal.js";
import { IsoDate } from "../../engine/dates/isoDate.js";

/**
 * Serialized (JSON/SQLite-friendly) representations of engine value types, plus
 * bidirectional mappers. This is the ONLY place that converts between the engine's
 * exact bigint/Decimal types and plain strings — domain entities and repositories
 * must go through these, never hand-roll their own (de)serialization.
 */

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((code) => {
    try {
      minorUnitExponent(code);
      return true;
    } catch {
      return false;
    }
  }, "Unknown or unregistered currency code");

export const moneySchema = z.object({
  minorUnits: z.string().regex(/^-?\d+$/, "minorUnits must be an integer string"),
  currency: currencyCodeSchema,
});
export type SerializedMoney = z.infer<typeof moneySchema>;

export function moneyToSerialized(money: Money): SerializedMoney {
  return { minorUnits: money.minorUnits.toString(), currency: money.currency };
}

export function moneyFromSerialized(value: SerializedMoney): Money {
  return Money.fromMinorUnits(BigInt(value.minorUnits), value.currency);
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => {
    try {
      IsoDate.fromString(value);
      return true;
    } catch {
      return false;
    }
  }, "not a valid calendar date");
export type SerializedIsoDate = z.infer<typeof isoDateSchema>;

export function isoDateToSerialized(date: IsoDate): SerializedIsoDate {
  return date.toString();
}

export function isoDateFromSerialized(value: SerializedIsoDate): IsoDate {
  return IsoDate.fromString(value);
}

export const decimalSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "must be a plain decimal literal, e.g. \"0.035\"");
export type SerializedDecimal = z.infer<typeof decimalSchema>;

export function decimalToSerialized(decimal: Decimal): SerializedDecimal {
  return decimal.toString();
}

export function decimalFromSerialized(value: SerializedDecimal): Decimal {
  return Decimal.fromString(value);
}
