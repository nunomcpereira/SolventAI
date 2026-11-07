import "server-only";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import { createSqliteLoanRepository } from "../db/repositories/index.js";
import { emitChange } from "./changeEvents.js";
import { Decimal } from "../../engine/money/decimal.js";
import {
  EURIBOR_SOURCE_URL,
  euriborTenorOf,
  parseEuriborTable,
  type EuriborQuote,
  type EuriborTenor,
} from "../marketRates/euribor.js";

const FETCH_TIMEOUT_MS = 10_000;

/**
 * The app's only outbound request besides the (user-configured) LLM endpoint. It runs solely
 * when the user presses "Update Euribor rates", sends no data (a plain GET with a generic
 * user agent), and only reads the public rates table.
 */
export async function fetchCurrentEuribor(fetchImpl: typeof fetch = fetch): Promise<EuriborQuote> {
  const response = await fetchImpl(EURIBOR_SOURCE_URL, {
    headers: { "User-Agent": "SolventAI (local personal finance app)", Accept: "text/html" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`euribor-rates.eu answered HTTP ${response.status}`);
  return parseEuriborTable(await response.text());
}

export interface EuriborLoanUpdate {
  loanId: string;
  loanName: string;
  tenor: EuriborTenor;
  previousRate: string;
  newRate: string;
}

export interface EuriborUpdateResult {
  asOf: string;
  updated: EuriborLoanUpdate[];
  /** Euribor-linked loans already at the published rate. */
  unchanged: number;
  /** Loans whose index looks like Euribor but whose tenor isn't published (e.g. "Euribor 9M"). */
  unmatched: { loanName: string; index: string }[];
}

/**
 * Sets `currentIndexRate` on every variable/mixed loan whose index is a Euribor tenor to the
 * latest published fixing. Only that one field changes — index name, spread, caps and the
 * fixed leg are untouched — and each save goes through the repository, so it shows up in the
 * entity history like any other edit.
 */
export async function applyCurrentEuriborToLoans(fetchImpl: typeof fetch = fetch): Promise<EuriborUpdateResult> {
  const quote = await fetchCurrentEuribor(fetchImpl);
  const db = await getDb();
  await ensureSeeded(db);
  const repo = createSqliteLoanRepository(db);

  const result: EuriborUpdateResult = { asOf: quote.asOf, updated: [], unchanged: 0, unmatched: [] };
  for (const loan of await repo.list()) {
    if (loan.rate.type === "fixed") continue;
    const tenor = euriborTenorOf(loan.rate.index);
    const published = tenor ? quote.rates[tenor] : undefined;
    if (!tenor || published === undefined) {
      if (/euribor/i.test(loan.rate.index)) result.unmatched.push({ loanName: loan.name, index: loan.rate.index });
      continue;
    }
    const newRate = Decimal.fromString(published);
    if (newRate.compare(loan.rate.currentIndexRate) === 0) {
      result.unchanged += 1;
      continue;
    }
    await repo.save({ ...loan, rate: { ...loan.rate, currentIndexRate: newRate } });
    result.updated.push({
      loanId: loan.id,
      loanName: loan.name,
      tenor,
      previousRate: loan.rate.currentIndexRate.toString(),
      newRate: newRate.toString(),
    });
  }
  if (result.updated.length > 0) emitChange("loans");
  return result;
}
