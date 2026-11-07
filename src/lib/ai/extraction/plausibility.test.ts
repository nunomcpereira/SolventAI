import { describe, expect, it } from "vitest";
import { flagInconsistentFields, type MergedRawFields } from "./plausibility.js";

const f = (value: unknown, sourceReference?: string) => ({
  value,
  confidence: 1,
  ...(sourceReference !== undefined ? { sourceReference } : {}),
});

describe("flagInconsistentFields", () => {
  it("flags the real CGD mistakes: 'variable' quoted from 'Mista', fixedRate taken from a spread line", () => {
    // Values and quotes as returned by the local LLM for "CGD taxa fixa 3 anos 3%.pdf".
    const merged: MergedRawFields = {
      loanType: f("mortgage", "Finalidade Aquisição Destino Habitação Própria Permanente"),
      term: f(405, "Prazo total (em meses) 405"),
      rateType: f("variable", "Tipo de taxa Mista Spread Base – Período Variável"),
      fixedRate: f("0.0025", "Spread Base – Período Fixa 0,250%"),
      index: f("Euribor 6 months", "o indexante (Euribor 6 meses)"),
      spread: f("0.007", "Spread – Período Variável 0,700%"),
      paymentFrequency: f("monthly", "Encargos mensais"),
    };

    const flagged = flagInconsistentFields(merged);

    expect(flagged.sort()).toEqual(["fixedRate", "rateType"]);
    expect(merged.rateType?.confidence).toBe(0);
    expect(merged.fixedRate?.confidence).toBe(0);
    // Values are kept for the reviewer; a 405-month term stated by the contract is not flagged.
    expect(merged.rateType?.value).toBe("variable");
    expect(merged.term?.confidence).toBe(1);
  });

  it("accepts a consistent mixed-rate extraction", () => {
    const merged: MergedRawFields = {
      rateType: f("mixed", "Tipo de taxa: Mista"),
      fixedRate: f("0.03", "TAN período fixo 3,000%"),
      fixedRatePeriods: f(36),
      index: f("EURIBOR_6M"),
      spread: f("0.007", "Spread 0,700%"),
      term: f(360),
      startDate: f("2024-07-07"),
      maturityDate: f("2054-07-07"),
      paymentFrequency: f("monthly"),
    };
    expect(flagInconsistentFields(merged)).toEqual([]);
  });

  it("recognises 'mixed' wording in other supported languages", () => {
    for (const quote of ["Tasa mixta", "Taux mixte", "MISTA", "mixed rate"]) {
      const merged: MergedRawFields = { rateType: f("fixed", quote) };
      expect(flagInconsistentFields(merged), quote).toContain("rateType");
    }
  });

  it("flags a non-mixed rate type that comes with a fixed-period length", () => {
    const merged: MergedRawFields = { rateType: f("variable"), fixedRatePeriods: f(24) };
    expect(flagInconsistentFields(merged).sort()).toEqual(["fixedRatePeriods", "rateType"]);
  });

  it("flags a fixed rate type that comes with an index or spread", () => {
    expect(flagInconsistentFields({ rateType: f("fixed"), spread: f("0.01") })).toEqual(["rateType"]);
  });

  it("flags a fixedRate identical to the spread", () => {
    expect(flagInconsistentFields({ fixedRate: f("0.007"), spread: f("0.007") })).toEqual(["fixedRate"]);
  });

  it("flags a term longer than 50 years for the payment frequency", () => {
    expect(flagInconsistentFields({ term: f(601), paymentFrequency: f("monthly") })).toEqual(["term"]);
    expect(flagInconsistentFields({ term: f(600), paymentFrequency: f("monthly") })).toEqual([]);
    expect(flagInconsistentFields({ term: f(120), paymentFrequency: f("annual") })).toEqual(["term"]);
  });

  it("flags a term that doesn't match the start and maturity dates", () => {
    const base = { startDate: f("2024-07-07"), maturityDate: f("2054-07-07"), paymentFrequency: f("monthly") };
    expect(flagInconsistentFields({ ...base, term: f(361) })).toEqual([]);
    expect(flagInconsistentFields({ ...base, term: f(30) })).toEqual(["term"]);
  });

  it("flags fields the chunks disagreed on, but leaves missing ones alone", () => {
    const merged: MergedRawFields = { loanType: f("mortgage"), spread: { value: null } };
    expect(flagInconsistentFields(merged, new Set(["loanType", "spread"])).sort()).toEqual(["loanType", "spread"]);
    expect(merged.loanType?.confidence).toBe(0);
    expect(merged.spread?.confidence).toBeUndefined();
  });
});
