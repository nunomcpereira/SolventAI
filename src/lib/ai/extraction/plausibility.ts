import { type LlmContractExtraction } from "./rawSchema.js";
import { type RawFieldEntry } from "./pipeline.js";
// (type-only import: no runtime cycle with pipeline.ts)

export type MergedRawFields = Partial<Record<keyof LlmContractExtraction, RawFieldEntry>>;
type FieldKey = keyof LlmContractExtraction;

/**
 * Deterministic cross-checks on the merged LLM output, run before mapping to
 * ExtractedFields. None of them change a value — the LLM's candidate stays visible — they
 * only force confidence to 0, which maps the field to "ambiguous" so the review UI asks a
 * human to confirm it (spec section 2.2: the LLM proposes, it never decides).
 *
 * Each rule targets an error seen on real contracts, e.g. a Portuguese mortgage where the
 * model returned rateType "variable" while quoting "Tipo de taxa Mista", and a fixedRate
 * of 0.25% taken from "Spread Base – Período Fixa 0,250%".
 */
export function flagInconsistentFields(merged: MergedRawFields, conflicting: ReadonlySet<FieldKey> = new Set()): FieldKey[] {
  const flagged = new Set<FieldKey>(conflicting);

  for (const key of rateTypeContradictsEvidence(merged)) flagged.add(key);
  if (fixedRateLooksLikeSpread(merged)) flagged.add("fixedRate");
  if (termImplausible(merged)) flagged.add("term");
  if (termContradictsDates(merged)) flagged.add("term");

  for (const key of flagged) {
    const field = merged[key];
    if (field && field.value !== null && field.value !== undefined) merged[key] = { ...field, confidence: 0 };
  }
  return [...flagged];
}

const present = (field: RawFieldEntry | undefined): field is RawFieldEntry =>
  field !== undefined && field.value !== null && field.value !== undefined;

const normalize = (text: string | undefined) =>
  (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "Mixed rate" in the languages the app supports (pt, es, fr, de, en). */
const MIXED_RATE_WORDS = /\b(mista|mixta|mixte|mixed|gemischt\w*|misto)\b/;
/** Words for a spread/margin over the index, as opposed to the full rate. */
const SPREAD_WORDS = /\b(spread|margem|margen|marge|diferencial|aufschlag|marja)\b/;

function rateTypeContradictsEvidence(merged: MergedRawFields): FieldKey[] {
  const rateType = merged.rateType;
  if (!present(rateType)) return [];
  const value = rateType.value;

  // The quote the model gave as its own source says "mixed".
  if (value !== "mixed" && MIXED_RATE_WORDS.test(normalize(rateType.sourceReference))) return ["rateType"];

  // A fixed leg length only exists for mixed loans.
  if (value !== "mixed" && present(merged.fixedRatePeriods)) return ["rateType", "fixedRatePeriods"];

  // A fixed loan has no index or spread.
  if (value === "fixed" && (present(merged.spread) || present(merged.index))) return ["rateType"];

  return [];
}

/** fixedRate must be the full rate charged; the prompt says so, but models still grab the spread. */
function fixedRateLooksLikeSpread(merged: MergedRawFields): boolean {
  const fixedRate = merged.fixedRate;
  if (!present(fixedRate)) return false;
  if (SPREAD_WORDS.test(normalize(fixedRate.sourceReference))) return true;
  const spread = merged.spread;
  return present(spread) && typeof spread.value === "string" && spread.value === fixedRate.value;
}

const PERIODS_PER_YEAR: Record<string, number> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

function periodsPerYear(merged: MergedRawFields): number {
  const frequency = merged.paymentFrequency?.value;
  return (typeof frequency === "string" && PERIODS_PER_YEAR[frequency]) || 12;
}

/** Longer than 50 years is not a consumer loan term; a units slip (years given as periods) is likelier. */
const MAX_TERM_YEARS = 50;

function termImplausible(merged: MergedRawFields): boolean {
  const term = merged.term;
  if (!present(term) || typeof term.value !== "number") return false;
  return term.value < 1 || term.value > MAX_TERM_YEARS * periodsPerYear(merged);
}

/** When both dates are known, the number of periods between them must match `term` (±1). */
function termContradictsDates(merged: MergedRawFields): boolean {
  const term = merged.term;
  const start = merged.startDate;
  const maturity = merged.maturityDate;
  if (!present(term) || !present(start) || !present(maturity) || typeof term.value !== "number") return false;
  const startMs = Date.parse(String(start.value));
  const maturityMs = Date.parse(String(maturity.value));
  if (Number.isNaN(startMs) || Number.isNaN(maturityMs) || maturityMs <= startMs) return false;
  const years = (maturityMs - startMs) / (365.2425 * 24 * 60 * 60 * 1000);
  const expected = Math.round(years * periodsPerYear(merged));
  return Math.abs(expected - term.value) > 1;
}

/** Stable comparison of raw values (objects like money compare structurally). */
export function sameRawValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
