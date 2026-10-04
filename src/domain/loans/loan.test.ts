import { describe, expect, it } from "vitest";
import { parseLoan, serializeLoan } from "./loan.js";
import { DomainValidationError } from "../shared/errors.js";

function fixedRateRaw() {
  return {
    id: "loan-1",
    name: "Home Mortgage",
    category: "mortgage",
    principal: { minorUnits: "20000000", currency: "EUR" },
    startDate: "2026-01-01",
    numberOfPeriods: 360,
    paymentFrequency: "monthly",
    amortizationType: "french",
    dayCountConvention: "actual/365",
    rate: { type: "fixed", annualRate: "0.035" },
    sourceAccountId: "acc-1",
    fees: [{ id: "fee-1", description: "Origination fee", amount: { minorUnits: "50000", currency: "EUR" }, timing: "origination" }],
    prepaymentPenalty: { type: "percentage", rate: "0.005", maximumPenalty: { minorUnits: "100000", currency: "EUR" } },
  };
}

function variableRateRaw() {
  return {
    ...fixedRateRaw(),
    id: "loan-2",
    rate: {
      type: "variable",
      index: "EURIBOR_6M",
      currentIndexRate: "0.02",
      spread: "0.01",
      resetFrequency: "semiannual",
      rateCap: "0.08",
    },
  };
}

function mixedRateRaw() {
  return {
    ...fixedRateRaw(),
    id: "loan-3",
    rate: {
      type: "mixed",
      fixedAnnualRate: "0.03",
      fixedPeriodCount: 24,
      index: "EURIBOR_6M",
      currentIndexRate: "0.02",
      spread: "0.01",
      resetFrequency: "semiannual",
    },
  };
}

describe("parseLoan", () => {
  it("parses a fixed-rate loan into engine-typed fields", () => {
    const loan = parseLoan(fixedRateRaw());
    expect(loan.principal.toDecimalString()).toBe("200000.00");
    expect(loan.rate.type).toBe("fixed");
    expect(loan.fees).toHaveLength(1);
    expect(loan.prepaymentPenalty.type).toBe("percentage");
  });

  it("parses a variable-rate loan with cap", () => {
    const loan = parseLoan(variableRateRaw());
    expect(loan.rate.type).toBe("variable");
    if (loan.rate.type === "variable") {
      expect(loan.rate.index).toBe("EURIBOR_6M");
      expect(loan.rate.rateCap?.toString()).toBe("0.08");
    }
  });

  it("parses a mixed-rate loan", () => {
    const loan = parseLoan(mixedRateRaw());
    expect(loan.rate.type).toBe("mixed");
    if (loan.rate.type === "mixed") {
      expect(loan.rate.fixedPeriodCount).toBe(24);
      expect(loan.rate.index).toBe("EURIBOR_6M");
    }
  });

  it("round-trips through serializeLoan for both rate types", () => {
    for (const raw of [fixedRateRaw(), variableRateRaw(), mixedRateRaw()]) {
      const loan = parseLoan(raw);
      const reparsed = parseLoan(serializeLoan(loan));
      expect(reparsed).toEqual(loan);
    }
  });

  it("rejects non-positive principal", () => {
    expect(() => parseLoan({ ...fixedRateRaw(), principal: { minorUnits: "0", currency: "EUR" } })).toThrow(
      DomainValidationError,
    );
  });

  it("rejects unknown amortization type", () => {
    expect(() => parseLoan({ ...fixedRateRaw(), amortizationType: "bullet" })).toThrow(DomainValidationError);
  });

  it("rejects malformed rate discriminant", () => {
    expect(() => parseLoan({ ...fixedRateRaw(), rate: { type: "hybrid", annualRate: "0.03" } })).toThrow(
      DomainValidationError,
    );
  });

  it("prepaymentPenalty type 'none' parses without extra fields", () => {
    const loan = parseLoan({ ...fixedRateRaw(), prepaymentPenalty: { type: "none" } });
    expect(loan.prepaymentPenalty).toEqual({ type: "none" });
  });
});
