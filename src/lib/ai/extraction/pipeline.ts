import { z } from "zod";
import { IsoDate } from "../../../engine/dates/isoDate.js";
import { parseContractExtraction, type ContractExtraction } from "../../../domain/contracts/contract.js";
import { type LlmClient } from "./llmClient.js";
import { llmContractExtractionSchema, mapToExtractedFieldInput, type LlmContractExtraction } from "./rawSchema.js";
import { DomainValidationError } from "../../../domain/shared/errors.js";
import { logLlmExchange } from "./extractionLogger.js";
import { chunkContractPages, type ContractChunk, type ContractPage } from "./chunking.js";

export class ExtractionParseError extends Error {
  constructor(public readonly rawText: string, cause: unknown) {
    super(`LLM response was not valid JSON: ${(cause as Error).message}`);
    this.name = "ExtractionParseError";
  }
}

export class ExtractionSchemaError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(`LLM response did not match the contract extraction schema: ${issues.map((i) => `${i.path} - ${i.message}`).join("; ")}`);
    this.name = "ExtractionSchemaError";
  }
}

/**
 * Format hints for fields whose value isn't a plain enum/string — derived by hand
 * from rawSchema's moneySchema/decimalSchema/isoDateSchema/array shapes, since those
 * structural shapes aren't self-describing the way a ZodEnum's `.options` is.
 */
const STRUCTURAL_FORMAT_HINTS: Partial<Record<keyof LlmContractExtraction, string>> = {
  principal: 'object {"minorUnits": "<integer string, smallest currency unit>", "currency": "<ISO 4217 code>"}',
  term: "integer number of payment periods (not a frequency label)",
  startDate: 'date string "YYYY-MM-DD"',
  maturityDate: 'date string "YYYY-MM-DD"',
  fixedRate:
    'plain decimal string, the FULL interest rate charged during the fixed leg (reference/index rate + spread already summed), ' +
    'NOT the spread alone — e.g. a contract stating "reference rate 3.00% + spread 0.25% = TAN 3.25%" must produce "0.0325", not "0.0025". ' +
    'Convert percent to decimal by dividing by 100: "3.25%" -> "0.0325" (not "3.25" and not "0.25"). ' +
    'If rateType is "mixed", this is the rate for the initial fixed period only (see fixedRatePeriods).',
  fixedRatePeriods:
    'integer number of payment periods the FIXED leg lasts before switching to variable — only set when rateType is "mixed" ' +
    '(e.g. contract says "taxa fixa durante 36 prestações" -> 36); null/omit if rateType is "fixed" or "variable".',
  indexRate:
    'plain decimal string, the CURRENT numeric value of the reference index named in `index` (e.g. contract states ' +
    '"indexante (Euribor 6 meses) de 3,895%" -> "0.03895"). Distinct from `spread`, which is the margin added on top. ' +
    'Only set when rateType is "variable" or "mixed".',
  spread:
    'plain decimal string, the spread/margin ADDED TO the reference index rate, on its own — e.g. "0.70%" -> "0.0070". ' +
    'Only set when rateType is "variable" or "mixed".',
  fees: 'array of {"description": string, "amount": {"minorUnits": "<integer string>", "currency": "<ISO 4217 code>"}}',
  insurance:
    'array of {"description": string, "amount": {"minorUnits": "<integer string>", "currency": "<ISO 4217 code>"}}',
  prepaymentRules:
    'array of {"description": string, "percentage"?: "<decimal string>", "fixedAmount"?: {"minorUnits": "<integer string>", "currency": "<ISO 4217 code>"}}',
};

/**
 * Guardrail against schema mismatches like the model returning source-language text
 * ("Mista") instead of the schema's literal enum values ("variable"): enum
 * constraints are read directly off llmContractExtractionSchema (single source of
 * truth, no hand-copied enum lists to drift out of sync) and spelled out per field so
 * the model is told exactly what's allowed instead of discovering it via a rejection.
 */
function describeField(key: keyof LlmContractExtraction): string {
  const fieldSchema = llmContractExtractionSchema.shape[key];
  const valueSchema = fieldSchema.shape.value;
  const unwrapped = valueSchema instanceof z.ZodNullable ? valueSchema.unwrap() : valueSchema;
  if (unwrapped instanceof z.ZodEnum) {
    return `${key}: MUST be exactly one of: ${unwrapped.options.join(", ")} (classify/translate the source text into one of these; never output the source-language wording or a raw code)`;
  }
  const structuralHint = STRUCTURAL_FORMAT_HINTS[key];
  return structuralHint ? `${key}: ${structuralHint}` : key;
}

/**
 * Instructs the model to return ONLY a JSON object matching the field set below, one
 * entry per field with {value, confidence, sourceReference}. The schema/mapping layer
 * is still the authority on correctness (spec section 2.2: the LLM extracts
 * candidates; it never determines financial truth) — but every field's required
 * value shape is now spelled out explicitly so the model has a fair chance of
 * producing schema-valid output instead of free-form prose the schema then rejects.
 */
export function buildExtractionPrompt(contractText: string, section?: { label: string; isPartial: boolean }): string {
  const fieldDescriptions = (Object.keys(llmContractExtractionSchema.shape) as (keyof LlmContractExtraction)[])
    .map(describeField)
    .join("\n");
  return [
    section?.isPartial
      ? `You are extracting from ONE SECTION of a larger loan contract (${section.label}). A field's defining clause ` +
        "may live in a different section — set value to null for any field not present in THIS section rather than " +
        "guessing from context. Return ONLY a JSON object with these top-level keys and value formats:"
      : "Extract loan contract fields from the text below. Return ONLY a JSON object with these top-level keys and value formats:",
    fieldDescriptions,
    'Each key\'s value must be an object: {"value": <extracted value in the exact format above, or null>, "confidence": <0-1>, "sourceReference": <short quote or page ref>}.',
    "If a field is not present in the text, set value to null. Do not guess. Do not include any text outside the JSON object.",
    "--- CONTRACT TEXT START ---",
    contractText,
    "--- CONTRACT TEXT END ---",
  ].join("\n\n");
}

interface ChunkProgress {
  chunkIndex: number;
  chunksTotal: number;
  label: string;
  /** Fields merged from all chunks completed so far — present only on the post-chunk
   * progress call, once this chunk's fields have been merged in (not on the pre-chunk
   * "starting" call, where nothing new is known yet). */
  fields?: Partial<Record<keyof LlmContractExtraction, RawFieldEntry>>;
}

export type RawFieldEntry = { value: unknown; confidence?: number | null; sourceReference?: string };

/** Runs a single chunk's text through the LLM and returns its validated raw fields (or throws). */
async function extractChunkRaw(
  chunk: ContractChunk,
  llm: LlmClient,
  documentId: string,
  extractionId: string,
): Promise<LlmContractExtraction> {
  const chunkInfo = { index: chunk.index, total: chunk.total, label: chunk.label };
  const prompt = buildExtractionPrompt(chunk.text, { label: chunk.label, isPartial: chunk.total > 1 });
  await logLlmExchange({
    type: "request",
    timestamp: new Date().toISOString(),
    documentId,
    extractionId,
    prompt,
    chunk: chunkInfo,
  });

  const rawText = await llm.complete(prompt);
  await logLlmExchange({
    type: "response",
    timestamp: new Date().toISOString(),
    documentId,
    extractionId,
    rawResponse: rawText,
    chunk: chunkInfo,
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    await logLlmExchange({
      type: "parse_error",
      timestamp: new Date().toISOString(),
      documentId,
      extractionId,
      error: (error as Error).message,
      chunk: chunkInfo,
    });
    throw new ExtractionParseError(rawText, error);
  }

  const schemaResult = llmContractExtractionSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    const issues = schemaResult.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    await logLlmExchange({
      type: "schema_validation_error",
      timestamp: new Date().toISOString(),
      documentId,
      extractionId,
      issues,
      chunk: chunkInfo,
    });
    throw new ExtractionSchemaError(issues);
  }
  return schemaResult.data;
}

/** Higher confidence wins; a chunk with no value for a field never overwrites one that has a value. */
function preferField(existing: RawFieldEntry | undefined, candidate: RawFieldEntry): RawFieldEntry {
  if (!existing || existing.value === null || existing.value === undefined) return candidate;
  if (candidate.value === null || candidate.value === undefined) return existing;
  const existingConfidence = existing.confidence ?? 1;
  const candidateConfidence = candidate.confidence ?? 1;
  return candidateConfidence > existingConfidence ? candidate : existing;
}

/**
 * No real consumer loan carries a >30% annual rate — a value above that is far more
 * likely a units mistake (the model returning a raw percent like "0.25" for 0,25%, or
 * grabbing the spread instead of the full rate) than a genuine contract term. Forcing
 * confidence to 0 downgrades the field to "ambiguous" (see AMBIGUOUS_BELOW_CONFIDENCE
 * in rawSchema.ts) so it's surfaced for manual review instead of silently pre-filling
 * the loan form with a wrong rate.
 */
const MAX_PLAUSIBLE_ANNUAL_RATE = 0.3;

function flagImplausibleRates(merged: Partial<Record<keyof LlmContractExtraction, RawFieldEntry>>): void {
  for (const key of ["fixedRate", "spread", "indexRate"] as const) {
    const field = merged[key];
    if (!field || typeof field.value !== "string") continue;
    const numeric = Number(field.value);
    if (Number.isFinite(numeric) && (numeric > MAX_PLAUSIBLE_ANNUAL_RATE || numeric < 0)) {
      merged[key] = { ...field, confidence: 0 };
    }
  }
}

/**
 * Runs one contract's text through the local LLM and turns its raw JSON into a
 * domain-validated ContractExtraction. Every failure mode below is a typed error, not
 * a thrown-away exception or a silently-empty result — a caller (e.g. the upload UI)
 * can catch ExtractionParseError/ExtractionSchemaError specifically and route the
 * document to manual entry instead of losing the upload.
 *
 * When `pages` is given, the contract is split into page-range chunks (chunking.ts)
 * and sent to the LLM one chunk at a time, with `onProgress` firing before each chunk
 * — this turns a multi-minute single black-box call into a sequence the caller can
 * surface to the user ("Analyzing pages 4-6 of 18") instead of a silent wait. A
 * single chunk (no `pages`, or a document short enough to be one chunk) behaves
 * exactly as a single non-chunked call: any parse/schema failure throws immediately.
 * With multiple chunks, a failure in one chunk is logged and skipped rather than
 * aborting the whole document — the merged result from the remaining chunks is still
 * useful, and only fails outright if every chunk failed.
 */
export async function extractContractFields(params: {
  contractText: string;
  pages?: ContractPage[];
  llm: LlmClient;
  documentId: string;
  extractionId: string;
  extractedAt: IsoDate;
  onProgress?: (progress: ChunkProgress) => Promise<void> | void;
}): Promise<ContractExtraction> {
  const { documentId, extractionId } = params;
  const chunks =
    params.pages && params.pages.length > 0
      ? chunkContractPages(params.pages)
      : [{ index: 0, total: 1, label: "Full document", text: params.contractText }];

  const merged: Partial<Record<keyof LlmContractExtraction, RawFieldEntry>> = {};
  let lastError: unknown;
  let successCount = 0;

  for (const chunk of chunks) {
    await params.onProgress?.({ chunkIndex: chunk.index, chunksTotal: chunk.total, label: chunk.label });
    try {
      const raw = await extractChunkRaw(chunk, params.llm, documentId, extractionId);
      successCount += 1;
      for (const [key, field] of Object.entries(raw) as [keyof LlmContractExtraction, RawFieldEntry][]) {
        merged[key] = preferField(merged[key], field);
      }
      await params.onProgress?.({ chunkIndex: chunk.index, chunksTotal: chunk.total, label: chunk.label, fields: { ...merged } });
    } catch (error) {
      lastError = error;
      if (chunks.length === 1) throw error;
    }
  }

  if (successCount === 0) throw lastError;

  flagImplausibleRates(merged);

  const mappedFields = Object.fromEntries(
    (Object.keys(llmContractExtractionSchema.shape) as (keyof LlmContractExtraction)[]).map((key) => [
      key,
      mapToExtractedFieldInput(merged[key] ?? { value: null }),
    ]),
  );

  try {
    const extraction = parseContractExtraction({
      id: params.extractionId,
      documentId: params.documentId,
      extractedAt: params.extractedAt.toString(),
      ...mappedFields,
    });
    await logLlmExchange({ type: "validated", timestamp: new Date().toISOString(), documentId, extractionId });
    return extraction;
  } catch (error) {
    if (error instanceof DomainValidationError) {
      await logLlmExchange({
        type: "schema_validation_error",
        timestamp: new Date().toISOString(),
        documentId,
        extractionId,
        issues: error.issues,
      });
      throw new ExtractionSchemaError(error.issues);
    }
    throw error;
  }
}
