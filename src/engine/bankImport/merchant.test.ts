import { describe, expect, it } from "vitest";
import { merchantKey, guessExpenseCategory, guessIncomeCategory, looksLikeOwnTransfer, displayLabel } from "./merchant.js";

describe("merchantKey", () => {
  it("ignores punctuation, spacing, digits and legal suffixes", () => {
    expect(merchantKey("COMPRA BOLT.EU O 2602")).toBe(merchantKey("BOLT.EUO"));
    expect(merchantKey("PETROGAL S A")).toBe(merchantKey("PETROGAL"));
    expect(merchantKey("ALIEXPRESS.COM")).toBe(merchantKey("COMPRA ALIEXPRESSCOM"));
    expect(merchantKey("FARMACIA  SOUSA")).toBe(merchantKey("Farmácia Sousa"));
  });

  it("keeps masked phone numbers so MB WAY recipients stay apart", () => {
    expect(merchantKey("Trf Mbway 912XXX001")).not.toBe(merchantKey("Trf Mbway 963XXX002"));
    expect(merchantKey("Trf Mbway 912XXX001")).toBe(merchantKey("TRF MBWAY 912XXX001"));
  });
});

describe("categories", () => {
  it("uses keyword rules before the bank's own label", () => {
    expect(guessExpenseCategory("COMPRA WWW.CONTINENTE", "LEVANTAMENTOS")).toBe("food");
    expect(guessExpenseCategory("NOS Comunicacoes")).toBe("utilities");
    expect(guessExpenseCategory("ATM Posto Repsol")).toBe("discretionary");
    expect(guessExpenseCategory("PAG 10095 PAG-ESTADO")).toBe("government");
    expect(guessExpenseCategory("FIDELIDADE COMPANHI")).toBe("insurance");
    expect(guessExpenseCategory("XPTO LDA", "GAS/ELETRICIDADE")).toBe("utilities");
    expect(guessExpenseCategory("XPTO LDA", "Diversos")).toBe("other");
  });

  it("recognises telling income descriptions", () => {
    expect(guessIncomeCategory("VENCIMENTO MES")).toBe("salary");
    expect(guessIncomeCategory("TFI FULANO")).toBeUndefined();
  });

  it("flags own-account transfers", () => {
    expect(looksLikeOwnTransfer("TRF POUP PROGRAMADA")).toBe(true);
    expect(looksLikeOwnTransfer("REVOLUT**1234*")).toBe(true);
    expect(looksLikeOwnTransfer("NOS Comunicacoes")).toBe(false);
  });

  it("labels a group by its most common spelling", () => {
    expect(displayLabel(["NOS  Comunicacoes ", "NOS Comunicacoes", "NOS COMUNIC"])).toBe("NOS Comunicacoes");
  });
});
