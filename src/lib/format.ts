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

/**
 * Dates in this app are calendar dates ("YYYY-MM-DD"), which `new Date()` parses as UTC
 * midnight. Formatting them in UTC keeps the printed day/month the same in every
 * timezone — in local time, anywhere west of UTC would show the previous day (and the
 * 1st of a month would show the previous month on chart ticks).
 */
const CALENDAR_DATE = { timeZone: "UTC" } as const;

export function formatDate(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { ...CALENDAR_DATE, year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(isoDateString),
  );
}

/** "MMM YYYY" form used by timeline navigation range labels (e.g. "Aug 2026"). */
export function formatMonthYear(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { ...CALENDAR_DATE, year: "numeric", month: "short" }).format(new Date(isoDateString));
}

/** Compact "MMM YY" form used by chart X-axis ticks, where space is tight. */
export function formatMonthTick(isoDateString: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { ...CALENDAR_DATE, year: "2-digit", month: "short" }).format(new Date(isoDateString));
}

/** First day of every month in [startIso, endIso], as "YYYY-MM-01" — one axis tick per month. */
export function monthStartsBetween(startIso: string, endIso: string): string[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const ticks: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  if (start.getUTCDate() !== 1) month += 1;
  for (;;) {
    const tick = new Date(Date.UTC(year, month, 1));
    if (tick > end) break;
    ticks.push(tick.toISOString().slice(0, 10));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return ticks;
}

/** Clock time of a real timestamp (ISO datetime), in the machine's local timezone: "14:32". */
export function formatTime(isoDateTime: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(isoDateTime));
}

/** Local calendar day of a real timestamp, for grouping: "Saturday, 7 November 2026". */
export function formatDayHeading(isoDateTime: string, lang: string): string {
  const locale = LOCALE_BY_LANG[lang] ?? "en-US";
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(isoDateTime),
  );
}

/** Local "YYYY-MM-DD" of a real timestamp, as a grouping key. */
export function localDayKey(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
