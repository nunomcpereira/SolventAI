import { type LoanCategory } from "../../domain/loans/loan.js";
import { type Frequency } from "../../engine/dates/frequency.js";
import { type AmortizationType } from "../../engine/amortization/amortization.js";
import { type UploadContractResult } from "../services/contractsService.js";

export interface LoanContractDraftState {
  status: "idle" | "success" | "error";
  message?: string;
  contractDocumentId?: string;
  defaults?: {
    name: string;
    category: LoanCategory;
    principalAmount: string;
    currency: string;
    startDate: string;
    numberOfPeriods: string;
    paymentFrequency: Frequency;
    amortizationType: AmortizationType;
    fixedRate: string;
    euriborRate: string;
    spread: string;
    rateType: "fixed" | "variable" | "mixed";
    fixedRatePeriods: string;
    /** UI field keys whose extracted value had low confidence (e.g. an implausible
     * rate caught by the pipeline's plausibility guard) — surfaced as a warning next
     * to the pre-filled input instead of being silently trusted. */
    ambiguousFields: string[];
  };
}

export interface ParsedLoanFormInput {
  name: string;
  category: LoanCategory;
  principalAmount: string;
  currency: string;
  startDate: string;
  numberOfPeriods: number;
  paymentFrequency: Frequency;
  amortizationType: AmortizationType;
  rateType: "fixed" | "variable" | "mixed";
  fixedRate: string;
  euriborRate: string;
  spread: string;
  fixedRatePeriods: number;
  sourceAccountId: string;
  contractDocumentId?: string;
}

/** Shared shape behind every "create a loan from a form" action (manual entry, contract
 * extraction confirm, dashboard quick-add) — same fields, same fallback defaults. */
export function parseLoanFormCreate(formData: FormData, nameFallback = ""): ParsedLoanFormInput {
  const contractDocumentId = String(formData.get("contractDocumentId") ?? "").trim() || undefined;
  return {
    name: String(formData.get("name") ?? nameFallback),
    category: String(formData.get("category") ?? "personal") as LoanCategory,
    principalAmount: String(formData.get("principalAmount") ?? "0"),
    currency: String(formData.get("currency") ?? "EUR"),
    startDate: String(formData.get("startDate") ?? new Date().toISOString().slice(0, 10)),
    numberOfPeriods: Number(formData.get("numberOfPeriods") ?? 12),
    paymentFrequency: String(formData.get("paymentFrequency") ?? "monthly") as Frequency,
    amortizationType: String(formData.get("amortizationType") ?? "french") as AmortizationType,
    rateType: String(formData.get("rateType") ?? "fixed") as "fixed" | "variable" | "mixed",
    fixedRate: String(formData.get("fixedRate") ?? "0.05"),
    euriborRate: String(formData.get("euriborRate") ?? "0.02"),
    spread: String(formData.get("spread") ?? "0.01"),
    fixedRatePeriods: Number(formData.get("fixedRatePeriods") ?? 12),
    sourceAccountId: String(formData.get("sourceAccountId") ?? ""),
    ...(contractDocumentId ? { contractDocumentId } : {}),
  };
}

export interface LoanDraftMessages {
  missingFile: string;
  extractionFailed: string;
  extractionSuccess: string;
}

/** Shared mapping from a contract extraction result to loan-form defaults, used by both
 * the standalone loans page and the dashboard's "new loan" wizard extraction flow. */
export function buildLoanDraftFromExtraction(result: UploadContractResult, messages: LoanDraftMessages): LoanContractDraftState {
  if (!result.extraction) {
    return {
      status: "error",
      message: result.extractionError ?? messages.extractionFailed,
      contractDocumentId: result.document.id,
    };
  }

  const extraction = result.extraction;
  const principalValue = extraction.principal.value;
  const principalAmount =
    principalValue && typeof principalValue === "object" && "minorUnits" in principalValue
      ? (Number(principalValue.minorUnits) / 100).toString()
      : "10000";
  const currency =
    principalValue && typeof principalValue === "object" && "currency" in principalValue
      ? String(principalValue.currency || "EUR")
      : "EUR";

  const toPercent = (value: unknown, fallback: string): string =>
    value !== null && value !== undefined ? String(Number(value) * 100) : fallback;

  const fixedRate = toPercent(extraction.fixedRate.value, "4");
  const euriborRate = toPercent(extraction.indexRate.value, "2");
  const spread = toPercent(extraction.spread.value, "1");
  const rateType =
    extraction.rateType.value && ["fixed", "variable", "mixed"].includes(String(extraction.rateType.value))
      ? (String(extraction.rateType.value) as "fixed" | "variable" | "mixed")
      : "fixed";
  const fixedRatePeriods =
    typeof extraction.fixedRatePeriods.value === "number" || typeof extraction.fixedRatePeriods.value === "string"
      ? String(extraction.fixedRatePeriods.value)
      : "12";

  const ambiguousFields = (
    [
      ["category", extraction.loanType],
      ["principalAmount", extraction.principal],
      ["startDate", extraction.startDate],
      ["numberOfPeriods", extraction.term],
      ["paymentFrequency", extraction.paymentFrequency],
      ["amortizationType", extraction.amortizationType],
      ["fixedRate", extraction.fixedRate],
      ["euriborRate", extraction.indexRate],
      ["spread", extraction.spread],
      ["rateType", extraction.rateType],
      ["fixedRatePeriods", extraction.fixedRatePeriods],
    ] as const
  )
    .filter(([, field]) => field.status === "ambiguous")
    .map(([key]) => key);

  return {
    status: "success",
    message: messages.extractionSuccess,
    contractDocumentId: result.document.id,
    defaults: {
      name: result.document.fileName.replace(/\.pdf$/i, "") || "Extracted Loan",
      category:
        extraction.loanType.value &&
        ["mortgage", "auto", "personal", "consumer", "student", "other"].includes(String(extraction.loanType.value))
          ? (String(extraction.loanType.value) as LoanCategory)
          : "other",
      principalAmount,
      currency,
      startDate:
        typeof extraction.startDate.value === "string" && extraction.startDate.value.length > 0
          ? extraction.startDate.value
          : new Date().toISOString().slice(0, 10),
      numberOfPeriods:
        typeof extraction.term.value === "number" || typeof extraction.term.value === "string"
          ? String(extraction.term.value)
          : "12",
      paymentFrequency:
        extraction.paymentFrequency.value &&
        ["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"].includes(
          String(extraction.paymentFrequency.value),
        )
          ? (String(extraction.paymentFrequency.value) as Frequency)
          : "monthly",
      amortizationType:
        extraction.amortizationType.value &&
        ["french", "constant_amortization", "interest_only"].includes(String(extraction.amortizationType.value))
          ? (String(extraction.amortizationType.value) as AmortizationType)
          : "french",
      fixedRate,
      euriborRate,
      spread,
      rateType,
      fixedRatePeriods,
      ambiguousFields,
    },
  };
}
