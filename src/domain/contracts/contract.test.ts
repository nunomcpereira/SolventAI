import { describe, expect, it } from "vitest";
import {
  parseContractDocument,
  serializeContractDocument,
  parseContractExtraction,
  serializeContractExtraction,
  isReadyForLoanCreation,
} from "./contract.js";
import { DomainValidationError } from "../shared/errors.js";

function validDocumentRaw() {
  return { id: "doc-1", fileName: "mortgage.pdf", uploadedAt: "2026-01-01", sourceType: "text", status: "uploaded" };
}

describe("ContractDocument", () => {
  it("parses and round-trips", () => {
    const doc = parseContractDocument(validDocumentRaw());
    expect(parseContractDocument(serializeContractDocument(doc))).toEqual(doc);
  });

  it("rejects unknown sourceType", () => {
    expect(() => parseContractDocument({ ...validDocumentRaw(), sourceType: "fax" })).toThrow(DomainValidationError);
  });
});

function missingField() {
  return { value: null, status: "missing" as const };
}

function extractedField<T>(value: T, confidence = 0.9) {
  return { value, status: "extracted" as const, confidence, sourceReference: "p.1" };
}

function fullExtractionRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: "ext-1",
    documentId: "doc-1",
    extractedAt: "2026-01-02",
    loanType: extractedField("mortgage"),
    principal: extractedField({ minorUnits: "20000000", currency: "EUR" }),
    currency: extractedField("EUR"),
    term: extractedField(360),
    startDate: extractedField("2026-02-01"),
    maturityDate: extractedField("2056-02-01"),
    rateType: extractedField("fixed"),
    fixedRate: extractedField("0.035"),
    fixedRatePeriods: missingField(),
    index: missingField(),
    indexRate: missingField(),
    spread: missingField(),
    resetFrequency: missingField(),
    amortizationType: extractedField("french"),
    paymentFrequency: extractedField("monthly"),
    dayCountConvention: extractedField("actual/365"),
    fees: extractedField([{ description: "Origination", amount: { minorUnits: "50000", currency: "EUR" } }]),
    insurance: extractedField([]),
    prepaymentRules: extractedField([{ description: "2% in year 1", percentage: "0.02" }]),
    ...overrides,
  };
}

describe("ContractExtraction", () => {
  it("parses a full extraction with mixed extracted/missing fields", () => {
    const extraction = parseContractExtraction(fullExtractionRaw());
    expect(extraction.principal.value?.minorUnits).toBe("20000000");
    expect(extraction.index.status).toBe("missing");
    expect(extraction.index.value).toBeNull();
  });

  it("round-trips through serializeContractExtraction", () => {
    const extraction = parseContractExtraction(fullExtractionRaw());
    expect(parseContractExtraction(serializeContractExtraction(extraction))).toEqual(extraction);
  });

  it("rejects malformed JSON shape (wrong field type)", () => {
    expect(() => parseContractExtraction(fullExtractionRaw({ term: extractedField("not-a-number") }))).toThrow(
      DomainValidationError,
    );
  });

  it("rejects an extracted field with null value", () => {
    expect(() =>
      parseContractExtraction(fullExtractionRaw({ loanType: { value: null, status: "extracted" } })),
    ).toThrow(DomainValidationError);
  });

  it("accepts an ambiguous field (value present, flagged for review)", () => {
    const extraction = parseContractExtraction(
      fullExtractionRaw({ rateType: { value: "fixed", status: "ambiguous", confidence: 0.4 } }),
    );
    expect(extraction.rateType.status).toBe("ambiguous");
  });

  it("rejects unknown top-level fields silently passing through unvalidated enums", () => {
    expect(() => parseContractExtraction(fullExtractionRaw({ amortizationType: extractedField("bullet") }))).toThrow(
      DomainValidationError,
    );
  });
});

describe("isReadyForLoanCreation", () => {
  it("is false while required fields are only 'extracted' (not yet verified)", () => {
    const extraction = parseContractExtraction(fullExtractionRaw());
    expect(isReadyForLoanCreation(extraction)).toBe(false);
  });

  it("is true once all required fields are verified or user-overridden", () => {
    const verifiedOverrides = {
      loanType: { value: "mortgage", status: "verified" },
      principal: { value: { minorUnits: "20000000", currency: "EUR" }, status: "verified" },
      currency: { value: "EUR", status: "verified" },
      term: { value: 360, status: "verified" },
      startDate: { value: "2026-02-01", status: "verified" },
      rateType: { value: "fixed", status: "user-overridden" },
      amortizationType: { value: "french", status: "verified" },
      paymentFrequency: { value: "monthly", status: "verified" },
      dayCountConvention: { value: "actual/365", status: "verified" },
    };
    const extraction = parseContractExtraction(fullExtractionRaw(verifiedOverrides));
    expect(isReadyForLoanCreation(extraction)).toBe(true);
  });

  it("stays false if even one required field remains unverified", () => {
    const extraction = parseContractExtraction(
      fullExtractionRaw({
        loanType: { value: "mortgage", status: "verified" },
        // everything else left as "extracted" from fullExtractionRaw()
      }),
    );
    expect(isReadyForLoanCreation(extraction)).toBe(false);
  });
});
