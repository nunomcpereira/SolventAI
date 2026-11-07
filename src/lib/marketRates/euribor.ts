/**
 * Euribor support for the opt-in "update rates" action. Pure functions only: parsing the
 * public euribor-rates.eu table and mapping a loan's free-text index name to a tenor. The
 * network call lives in marketRatesService and only ever runs when the user asks for it.
 */

export const EURIBOR_SOURCE_URL = "https://www.euribor-rates.eu/en/current-euribor-rates/";

export type EuriborTenor = "1W" | "1M" | "3M" | "6M" | "12M";

export interface EuriborQuote {
  /** Fixing date of the quoted values, "YYYY-MM-DD". */
  asOf: string;
  /** Annual rates as decimal strings (e.g. "0.02392" for 2.392 %), per tenor found. */
  rates: Partial<Record<EuriborTenor, string>>;
}

export class EuriborParseError extends Error {
  constructor(message: string) {
    super(`Could not read Euribor rates: ${message}`);
    this.name = "EuriborParseError";
  }
}

const TENOR_BY_LABEL: Record<string, EuriborTenor> = {
  "1 week": "1W",
  "1 month": "1M",
  "3 months": "3M",
  "6 months": "6M",
  "12 months": "12M",
};

/** "2.392 %" -> "0.02392"; done on the digit string so no float rounding creeps in. */
export function percentToDecimalString(percent: string): string | undefined {
  const match = /^\s*(-?)(\d+)(?:[.,](\d+))?\s*%?\s*$/.exec(percent);
  if (!match) return undefined;
  const [, sign, whole = "0", fraction = ""] = match;
  const digits = (whole + fraction).replace(/^0+(?=\d)/, "");
  const scale = fraction.length + 2;
  const padded = digits.padStart(scale + 1, "0");
  const intPart = padded.slice(0, padded.length - scale);
  const fracPart = padded.slice(padded.length - scale).replace(/0+$/, "");
  const value = fracPart ? `${intPart}.${fracPart}` : intPart;
  return sign && value !== "0" ? `-${value}` : value;
}

/** "11/6/2026" (US month/day/year, as the English page prints it) -> "2026-11-06". */
function usDateToIso(text: string): string | undefined {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!match) return undefined;
  const [, month = "", day = "", year = ""] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Cell text from a table cell's inner HTML. Only ever used to read labels and numbers, never
 * rendered. Tags are removed until none remain (so nested/overlapping fragments like
 * "<scr<b>ipt>" can't reassemble), then any stray angle bracket is dropped.
 */
function stripTags(html: string): string {
  let text = html;
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  } while (text !== previous);
  return text.replace(/[<>]/g, "").replace(/&nbsp;/g, " ").trim();
}

/**
 * Reads the first (most recent) column of the "current Euribor rates" table: header row of
 * fixing dates, then one row per tenor. Throws EuriborParseError if the layout changed
 * rather than guessing — a wrong rate is worse than no update.
 */
export function parseEuriborTable(html: string): EuriborQuote {
  const table = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table) throw new EuriborParseError("no rates table found on the page");

  const headerCells = [...(/<thead[^>]*>([\s\S]*?)<\/thead>/i.exec(table)?.[1] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => stripTags(m[1] ?? ""))
    .filter((text) => text.length > 0);
  const asOf = headerCells.length > 0 ? usDateToIso(headerCells[0] ?? "") : undefined;
  if (!asOf) throw new EuriborParseError("the table has no recognisable date header");

  const rates: EuriborQuote["rates"] = {};
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = row[1] ?? "";
    const label = stripTags(/<th[^>]*>([\s\S]*?)<\/th>/i.exec(rowHtml)?.[1] ?? "").toLowerCase();
    const tenorMatch = /^euribor\s+(\d+\s+(?:week|months?))$/.exec(label);
    const tenor = tenorMatch ? TENOR_BY_LABEL[tenorMatch[1] ?? ""] : undefined;
    if (!tenor) continue;
    const firstCell = /<td[^>]*>([\s\S]*?)<\/td>/i.exec(rowHtml)?.[1];
    const value = firstCell !== undefined ? percentToDecimalString(stripTags(firstCell)) : undefined;
    if (value === undefined) throw new EuriborParseError(`unreadable value for Euribor ${tenor}`);
    rates[tenor] = value;
  }
  if (Object.keys(rates).length === 0) throw new EuriborParseError("no Euribor rows found in the table");
  return { asOf, rates };
}

/**
 * Maps a loan's index name to a Euribor tenor, or undefined if it isn't Euribor. Index names
 * come from forms ("EURIBOR_6M") and from contract extraction in several languages
 * ("Euribor 6 months", "Euribor a 6 meses", "Euribor 12 Monate").
 */
export function euriborTenorOf(indexName: string): EuriborTenor | undefined {
  const normalized = indexName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!normalized.includes("euribor")) return undefined;
  const match = /euribor[\W_]*(?:a[\W_]*)?(\d{1,2})\s*(w|week|weeks|semana|semanas|woche|wochen|semaine|semaines|m|month|months|mes|meses|monat|monate|mois)?\b/.exec(
    normalized,
  );
  if (!match) return undefined;
  const count = Number(match[1]);
  const unit = match[2] ?? "m";
  const isWeek = /^(w|week|weeks|semana|semanas|woche|wochen|semaine|semaines)$/.test(unit);
  if (isWeek) return count === 1 ? "1W" : undefined;
  const byMonths: Record<number, EuriborTenor> = { 1: "1M", 3: "3M", 6: "6M", 12: "12M" };
  return byMonths[count];
}
