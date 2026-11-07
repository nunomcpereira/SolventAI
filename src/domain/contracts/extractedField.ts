import { z } from "zod";

/**
 * Every field the AI extraction pipeline produces carries its provenance (spec
 * section 24/2.5) — the engine and domain layers must be able to distinguish these
 * states, and a value must never silently become "verified" without a human step:
 *  - "extracted": the LLM produced this value directly from contract text.
 *  - "inferred": derived (e.g. maturityDate computed from startDate + term) rather
 *    than read verbatim.
 *  - "ambiguous": the source text supports more than one reading; `value` may still
 *    be the extractor's best guess, but it MUST be surfaced for manual resolution.
 *  - "missing": no value could be found; `value` is null.
 *  - "user-overridden": a human replaced whatever the pipeline produced.
 *  - "verified": a human explicitly confirmed the extracted/inferred value as-is.
 */
export type ExtractionFieldStatus = "extracted" | "inferred" | "ambiguous" | "missing" | "user-overridden" | "verified";

export interface ExtractedField<T> {
  value: T | null;
  status: ExtractionFieldStatus;
  /** 0-1 confidence the extractor assigned. Absent once status is user-overridden/verified. */
  confidence?: number | undefined;
  /** Where in the source document this came from (e.g. a page number or quoted snippet). */
  sourceReference?: string | undefined;
}

const extractionFieldStatusSchema = z.enum([
  "extracted",
  "inferred",
  "ambiguous",
  "missing",
  "user-overridden",
  "verified",
]);

/** What the refinements below read. Spelled out because zod 4 cannot infer `value` through
 * the generic `Value` schema (the key disappears from the inferred object type). */
type RefinableField = { status: ExtractionFieldStatus; value?: unknown };

export function extractedFieldSchema<Value extends z.ZodTypeAny>(valueSchema: Value) {
  return z
    .object({
      value: valueSchema.nullable(),
      status: extractionFieldStatusSchema,
      confidence: z.number().min(0).max(1).optional(),
      sourceReference: z.string().optional(),
    })
    .refine((field: RefinableField) => field.status === "missing" || field.value !== null, {
      message: 'value must not be null unless status is "missing"',
      path: ["value"],
    })
    .refine((field: RefinableField) => field.status !== "missing" || field.value === null, {
      message: 'value must be null when status is "missing"',
      path: ["value"],
    });
}
