import { z } from "zod";
import { moneySchema, decimalSchema, isoDateSchema } from "../../../domain/shared/index.js";
import { frequencySchema, amortizationTypeSchema, dayCountConventionSchema } from "../../../domain/loans/loan.js";
import { loanTypeSchema, rateTypeSchema, feeItemSchema, prepaymentRuleSchema } from "../../../domain/contracts/contract.js";

/**
 * What we ask the LLM to produce: a value guess plus its own confidence — nothing
 * more. The LLM is explicitly NOT trusted to assign a review status (extracted vs
 * ambiguous vs verified); that classification is computed deterministically from
 * `confidence` in mapToExtractedFieldInput (spec section 2.2: the LLM extracts
 * candidates, it never determines financial truth or review state).
 */
function llmRawFieldSchema<Value extends z.ZodTypeAny>(valueSchema: Value) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    sourceReference: z.string().optional(),
  });
}

/** Matches the field set in domain/contracts' ContractExtraction (spec section 24). */
export const llmContractExtractionSchema = z.object({
  loanType: llmRawFieldSchema(loanTypeSchema),
  principal: llmRawFieldSchema(moneySchema),
  currency: llmRawFieldSchema(z.string()),
  term: llmRawFieldSchema(z.number().int().positive()),
  startDate: llmRawFieldSchema(isoDateSchema),
  maturityDate: llmRawFieldSchema(isoDateSchema),
  rateType: llmRawFieldSchema(rateTypeSchema),
  fixedRate: llmRawFieldSchema(decimalSchema),
  fixedRatePeriods: llmRawFieldSchema(z.number().int().positive()),
  index: llmRawFieldSchema(z.string()),
  indexRate: llmRawFieldSchema(decimalSchema),
  spread: llmRawFieldSchema(decimalSchema),
  resetFrequency: llmRawFieldSchema(frequencySchema),
  amortizationType: llmRawFieldSchema(amortizationTypeSchema),
  paymentFrequency: llmRawFieldSchema(frequencySchema),
  dayCountConvention: llmRawFieldSchema(dayCountConventionSchema),
  fees: llmRawFieldSchema(z.array(feeItemSchema)),
  insurance: llmRawFieldSchema(z.array(feeItemSchema)),
  prepaymentRules: llmRawFieldSchema(z.array(prepaymentRuleSchema)),
});
export type LlmContractExtraction = z.infer<typeof llmContractExtractionSchema>;

export type RawExtractedFieldInput = { value: unknown; status: string; confidence?: number; sourceReference?: string };

/**
 * Confidence at/above this threshold is treated as "extracted" (trustworthy enough to
 * show as a strong suggestion); below it, "ambiguous" (must be flagged for review).
 * A missing `confidence` from the LLM is treated as full confidence (1.0) — an
 * extractor that doesn't report confidence is not automatically distrusted, but it
 * also isn't given the benefit of an artificially low score.
 */
export const AMBIGUOUS_BELOW_CONFIDENCE = 0.7;

export function mapToExtractedFieldInput(raw: {
  value: unknown;
  confidence?: number | null | undefined;
  sourceReference?: string | undefined;
}): RawExtractedFieldInput {
  if (raw.value === null || raw.value === undefined) {
    return { value: null, status: "missing" };
  }
  const confidence = raw.confidence ?? 1;
  const status = confidence >= AMBIGUOUS_BELOW_CONFIDENCE ? "extracted" : "ambiguous";
  return {
    value: raw.value,
    status,
    confidence,
    ...(raw.sourceReference !== undefined ? { sourceReference: raw.sourceReference } : {}),
  };
}
