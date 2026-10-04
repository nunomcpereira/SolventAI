import { type Money } from "../engine/money/money.js";

const LOCALE_BY_LANG: Record<string, string> = { en: "en-US", pt: "pt-PT", es: "es-ES", de: "de-DE", fr: "fr-FR" };

/**
 * Formats an exact Money value for display using locale-aware currency formatting
 * (spec section 28). This conversion to `number` is display-only, at the very last
 * step, and is never fed back into any calculation — the engine's own arithmetic
 * never touches `number`.
 */
export function formatMoney(money: Money, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: money.currency }).format(
    Number(money.toDecimalString()),
  );
}

export function formatPercent(value: string, lang: string, fractionDigits = 1): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits }).format(
    Number(value),
  ) + "%";
}

export function formatDate(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(isoDateString),
  );
}

/** "MMM YYYY" form used by timeline navigation range labels (e.g. "Aug 2026"). */
export function formatMonthYear(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short" }).format(new Date(isoDateString));
}

/** Compact "MMM YY" form used by chart X-axis ticks, where space is tight. */
export function formatMonthTick(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { year: "2-digit", month: "short" }).format(new Date(isoDateString));
}
