/**
 * Minor-unit exponent per ISO 4217. Extend as needed; missing currency is a hard error
 * (never silently assume 2 decimals — some currencies use 0 or 3).
 */
const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  CHF: 2,
  JPY: 0,
  KWD: 3,
};

export type CurrencyCode = string;

export function minorUnitExponent(currency: CurrencyCode): number {
  const exp = CURRENCY_EXPONENTS[currency.toUpperCase()];
  if (exp === undefined) {
    throw new Error(`Unknown currency code: ${currency}. Register its minor-unit exponent explicitly.`);
  }
  return exp;
}

export function minorUnitScale(currency: CurrencyCode): bigint {
  return 10n ** BigInt(minorUnitExponent(currency));
}
