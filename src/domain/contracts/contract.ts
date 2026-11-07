import { z } from "zod";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import {
  moneySchema,
  decimalSchema,
  isoDateSchema,
  type SerializedMoney,
  type SerializedDecimal,
  type SerializedIsoDate,
  isoDateToSerialized,
  isoDateFromSerialized,
  DomainValidationError,
  type Repository,
} from "../shared/index.js";
import { extractedFieldSchema, type ExtractedField } from "./extractedField.js";
import { frequencySchema, amortizationTypeSchema, dayCountConventionSchema } from "../loans/loan.js";

export type ContractDocumentStatus = "uploaded" | "extracting" | "extracted" | "failed";
export type ContractSourceType = "text" | "scanned" | "unknown";

/** Metadata for an uploaded contract file (spec section 23). The file bytes
 * themselves live on disk / in blob storage — this is the domain record about them. */
export interface ContractDocument {
  id: string;
  fileName: string;
  uploadedAt: IsoDate;
  sourceType: ContractSourceType;
  pageCount?: number;
  status: ContractDocumentStatus;
  /** Chunked-extraction progress, set only while status is "extracting" (spec section 23). */
  chunkTotal?: number;
  chunkDone?: number;
  chunkLabel?: string;
  /** Raw field values merged from completed chunks so far, keyed by LlmContractExtraction field name — lets a
   * polling UI show which fields are already known while extraction is still running. */
  partialFields?: Record<string, { value: unknown; confidence?: number | null }>;
  /** Human-readable failure reason, set only while status is "failed" or "uploaded" (AI disabled/no text). */
  error?: string;
  /** ISO datetime of the last extraction heartbeat (start or chunk completed). Used to detect
   * runs that died with the process — see isExtractionStale. */
  progressAt?: string;
  /** SHA-256 of the uploaded PDF bytes, used to recognise re-uploads of the same file. */
  contentHash?: string;
}

/** An extraction that has made no progress for this long is considered dead. One chunk is a
 * single local-LLM call, so ten minutes without a heartbeat means the run is gone. */
export const EXTRACTION_STALE_AFTER_MS = 10 * 60 * 1000;

export const INTERRUPTED_EXTRACTION_ERROR =
  "Extraction was interrupted (the app restarted or the AI server stopped responding). Retry to run it again.";

/**
 * True when a document claims to be "extracting" but its run can no longer be alive:
 * no heartbeat at all (rows written before heartbeats existed) or none within `staleAfterMs`.
 * Background extraction is an in-process promise, so a restart silently kills it.
 */
export function isExtractionStale(
  doc: Pick<ContractDocument, "status" | "progressAt">,
  now: Date,
  staleAfterMs: number = EXTRACTION_STALE_AFTER_MS,
): boolean {
  if (doc.status !== "extracting") return false;
  if (doc.progressAt === undefined) return true;
  const last = Date.parse(doc.progressAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > staleAfterMs;
}

export interface ContractDocumentRepository extends Repository<ContractDocument> {}

const contractDocumentStatusSchema = z.enum(["uploaded", "extracting", "extracted", "failed"]);
const contractSourceTypeSchema = z.enum(["text", "scanned", "unknown"]);

export const contractDocumentInputSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().trim().min(1),
  uploadedAt: isoDateSchema,
  sourceType: contractSourceTypeSchema,
  pageCount: z.number().int().positive().optional(),
  status: contractDocumentStatusSchema,
  chunkTotal: z.number().int().positive().optional(),
  chunkDone: z.number().int().nonnegative().optional(),
  chunkLabel: z.string().optional(),
  /** Loosely typed on purpose: this is an internal progress snapshot produced by our
   * own extraction pipeline, not user input, so it isn't worth a strict per-entry
   * schema (and z.unknown() fields make zod's inference mark them optional, which
   * fights exactOptionalPropertyTypes). Cast to the real shape in parseContractDocument. */
  partialFields: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  progressAt: z.string().datetime().optional(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type ContractDocumentInput = z.infer<typeof contractDocumentInputSchema>;

export interface SerializedContractDocument {
  id: string;
  fileName: string;
  uploadedAt: SerializedIsoDate;
  sourceType: ContractSourceType;
  pageCount?: number;
  status: ContractDocumentStatus;
  chunkTotal?: number;
  chunkDone?: number;
  chunkLabel?: string;
  partialFields?: Record<string, { value: unknown; confidence?: number | null }>;
  error?: string;
  progressAt?: string;
  contentHash?: string;
}

export function parseContractDocument(raw: unknown): ContractDocument {
  const result = contractDocumentInputSchema.safeParse(raw);
  if (!result.success) throw new DomainValidationError("ContractDocument", result.error);
  const input = result.data;
  return {
    id: input.id,
    fileName: input.fileName,
    uploadedAt: isoDateFromSerialized(input.uploadedAt),
    sourceType: input.sourceType,
    ...(input.pageCount !== undefined ? { pageCount: input.pageCount } : {}),
    status: input.status,
    ...(input.chunkTotal !== undefined ? { chunkTotal: input.chunkTotal } : {}),
    ...(input.chunkDone !== undefined ? { chunkDone: input.chunkDone } : {}),
    ...(input.chunkLabel !== undefined ? { chunkLabel: input.chunkLabel } : {}),
    ...(input.partialFields !== undefined
      ? { partialFields: input.partialFields as Record<string, { value: unknown; confidence?: number | null }> }
      : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
    ...(input.progressAt !== undefined ? { progressAt: input.progressAt } : {}),
    ...(input.contentHash !== undefined ? { contentHash: input.contentHash } : {}),
  };
}

export function serializeContractDocument(doc: ContractDocument): SerializedContractDocument {
  return {
    id: doc.id,
    fileName: doc.fileName,
    uploadedAt: isoDateToSerialized(doc.uploadedAt),
    sourceType: doc.sourceType,
    ...(doc.pageCount !== undefined ? { pageCount: doc.pageCount } : {}),
    status: doc.status,
    ...(doc.chunkTotal !== undefined ? { chunkTotal: doc.chunkTotal } : {}),
    ...(doc.chunkDone !== undefined ? { chunkDone: doc.chunkDone } : {}),
    ...(doc.chunkLabel !== undefined ? { chunkLabel: doc.chunkLabel } : {}),
    ...(doc.partialFields !== undefined ? { partialFields: doc.partialFields } : {}),
    ...(doc.error !== undefined ? { error: doc.error } : {}),
    ...(doc.progressAt !== undefined ? { progressAt: doc.progressAt } : {}),
    ...(doc.contentHash !== undefined ? { contentHash: doc.contentHash } : {}),
  };
}

// --- Contract extraction schema (spec section 24) ---------------------------------

export const loanTypeSchema = z.enum(["mortgage", "auto", "personal", "consumer", "student", "other"]);
export const rateTypeSchema = z.enum(["fixed", "variable", "mixed"]);

export const feeItemSchema = z.object({ description: z.string(), amount: moneySchema });
export const prepaymentRuleSchema = z.object({
  description: z.string(),
  percentage: decimalSchema.optional(),
  fixedAmount: moneySchema.optional(),
});

/** The raw shape a contract extraction fills in — every field is an ExtractedField. */
export const contractExtractionInputSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  extractedAt: isoDateSchema,
  loanType: extractedFieldSchema(loanTypeSchema),
  principal: extractedFieldSchema(moneySchema),
  currency: extractedFieldSchema(z.string()),
  term: extractedFieldSchema(z.number().int().positive()),
  startDate: extractedFieldSchema(isoDateSchema),
  maturityDate: extractedFieldSchema(isoDateSchema),
  rateType: extractedFieldSchema(rateTypeSchema),
  fixedRate: extractedFieldSchema(decimalSchema),
  fixedRatePeriods: extractedFieldSchema(z.number().int().positive()),
  index: extractedFieldSchema(z.string()),
  indexRate: extractedFieldSchema(decimalSchema),
  spread: extractedFieldSchema(decimalSchema),
  resetFrequency: extractedFieldSchema(frequencySchema),
  amortizationType: extractedFieldSchema(amortizationTypeSchema),
  paymentFrequency: extractedFieldSchema(frequencySchema),
  dayCountConvention: extractedFieldSchema(dayCountConventionSchema),
  fees: extractedFieldSchema(z.array(feeItemSchema)),
  insurance: extractedFieldSchema(z.array(feeItemSchema)),
  prepaymentRules: extractedFieldSchema(z.array(prepaymentRuleSchema)),
});
export type ContractExtractionInput = z.infer<typeof contractExtractionInputSchema>;

/**
 * A validated contract extraction. Field TYPES here intentionally mirror the raw
 * (still-serialized) shape — e.g. `principal.value` is `SerializedMoney`, not
 * `Money` — because an ambiguous/missing/unverified field cannot be trusted to
 * construct an engine value yet (spec section 2.5: extracted values must pass
 * deterministic validation before entering the financial engine; a Loan is only
 * built once every required field is "verified" or "user-overridden").
 */
export interface ContractExtraction {
  id: string;
  documentId: string;
  extractedAt: IsoDate;
  loanType: ExtractedField<"mortgage" | "auto" | "personal" | "consumer" | "student" | "other">;
  principal: ExtractedField<SerializedMoney>;
  currency: ExtractedField<string>;
  term: ExtractedField<number>;
  startDate: ExtractedField<SerializedIsoDate>;
  maturityDate: ExtractedField<SerializedIsoDate>;
  rateType: ExtractedField<"fixed" | "variable" | "mixed">;
  fixedRate: ExtractedField<SerializedDecimal>;
  /** Number of initial periods at fixedRate before switching to variable; only meaningful when rateType is "mixed". */
  fixedRatePeriods: ExtractedField<number>;
  index: ExtractedField<string>;
  /** Current numeric value of `index` (e.g. 0.03895 for Euribor 6M at 3.895%), distinct from `spread` (the margin added on top). */
  indexRate: ExtractedField<SerializedDecimal>;
  spread: ExtractedField<SerializedDecimal>;
  resetFrequency: ExtractedField<Frequency>;
  amortizationType: ExtractedField<"french" | "constant_amortization" | "interest_only">;
  paymentFrequency: ExtractedField<Frequency>;
  dayCountConvention: ExtractedField<"actual/360" | "actual/365" | "30/360">;
  fees: ExtractedField<{ description: string; amount: SerializedMoney }[]>;
  insurance: ExtractedField<{ description: string; amount: SerializedMoney }[]>;
  prepaymentRules: ExtractedField<
    { description: string; percentage?: SerializedDecimal | undefined; fixedAmount?: SerializedMoney | undefined }[]
  >;
}

export interface ContractExtractionRepository extends Repository<ContractExtraction> {}

export function parseContractExtraction(raw: unknown): ContractExtraction {
  const result = contractExtractionInputSchema.safeParse(raw);
  if (!result.success) throw new DomainValidationError("ContractExtraction", result.error);
  const input = result.data;
  return {
    ...input,
    extractedAt: isoDateFromSerialized(input.extractedAt),
  };
}

export function serializeContractExtraction(extraction: ContractExtraction): ContractExtractionInput {
  return {
    ...extraction,
    extractedAt: isoDateToSerialized(extraction.extractedAt),
  };
}

/**
 * The field names that must all be "verified" or "user-overridden" before an
 * extraction is trustworthy enough to construct a Loan from (spec section 2.5/24).
 */
export const REQUIRED_LOAN_FIELDS = [
  "loanType",
  "principal",
  "currency",
  "term",
  "startDate",
  "rateType",
  "amortizationType",
  "paymentFrequency",
  "dayCountConvention",
] as const;

export function isReadyForLoanCreation(extraction: ContractExtraction): boolean {
  return REQUIRED_LOAN_FIELDS.every((field) => {
    const status = extraction[field].status;
    return status === "verified" || status === "user-overridden";
  });
}
