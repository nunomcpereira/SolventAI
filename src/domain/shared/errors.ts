import type { ZodError } from "zod";

/** Raised when raw input fails domain validation. Carries the field-level issues so
 * callers (UI, AI-extraction review, tests) can present precise, actionable errors. */
export class DomainValidationError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(entityName: string, zodError: ZodError) {
    const issues = zodError.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    super(`Invalid ${entityName}: ${issues.map((i) => `${i.path || "(root)"} - ${i.message}`).join("; ")}`);
    this.name = "DomainValidationError";
    this.issues = issues;
  }
}
