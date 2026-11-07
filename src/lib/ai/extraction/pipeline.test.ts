import { describe, expect, it } from "vitest";
import { IsoDate } from "../../../engine/dates/isoDate.js";
import { type LlmClient } from "./llmClient.js";
import { extractContractFields, ExtractionParseError, ExtractionSchemaError } from "./pipeline.js";

function field(value: unknown, confidence = 0.95, sourceReference?: string) {
  return { value, confidence, ...(sourceReference !== undefined ? { sourceReference } : {}) };
}

function validRawFields(overrides: Record<string, unknown> = {}) {
  return {
    loanType: field("mortgage"),
    principal: field({ minorUnits: "20000000", currency: "EUR" }),
    currency: field("EUR"),
    term: field(360),
    startDate: field("2026-02-01"),
    maturityDate: field("2056-02-01"),
    rateType: field("fixed"),
    fixedRate: field("0.035"),
    fixedRatePeriods: field(null),
    index: field(null),
    indexRate: field(null),
    spread: field(null),
    resetFrequency: field(null),
    amortizationType: field("french"),
    paymentFrequency: field("monthly"),
    dayCountConvention: field("actual/365"),
    fees: field([{ description: "Origination", amount: { minorUnits: "50000", currency: "EUR" } }]),
    insurance: field([]),
    prepaymentRules: field([{ description: "0.5% penalty", percentage: "0.005" }]),
    ...overrides,
  };
}

function llmReturning(text: string): LlmClient {
  return { complete: async () => text };
}

function llmReturningJson(value: unknown): LlmClient {
  return llmReturning(JSON.stringify(value));
}

const baseParams = {
  documentId: "doc-1",
  extractionId: "ext-1",
  extractedAt: IsoDate.fromString("2026-01-02"),
};

describe("extractContractFields — valid extraction", () => {
  it("maps a well-formed LLM response into a domain ContractExtraction", async () => {
    const extraction = await extractContractFields({
      contractText: "some contract text",
      llm: llmReturningJson(validRawFields()),
      ...baseParams,
    });
    expect(extraction.principal.status).toBe("extracted");
    expect(extraction.principal.value?.minorUnits).toBe("20000000");
    expect(extraction.index.status).toBe("missing");
    expect(extraction.index.value).toBeNull();
  });
});

describe("extractContractFields — malformed JSON", () => {
  it("throws ExtractionParseError, preserving the raw text for debugging", async () => {
    const llm = llmReturning("this is not { valid json");
    await expect(extractContractFields({ contractText: "x", llm, ...baseParams })).rejects.toThrow(ExtractionParseError);
  });
});

describe("extractContractFields — missing required fields", () => {
  it("throws ExtractionSchemaError when a required top-level field is absent", async () => {
    const raw = validRawFields();
    delete (raw as Record<string, unknown>)["principal"];
    await expect(
      extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams }),
    ).rejects.toThrow(ExtractionSchemaError);
  });
});

describe("extractContractFields — ambiguous fields", () => {
  it("maps low-confidence values to status 'ambiguous', not silently accepted as fact", async () => {
    const raw = validRawFields({ rateType: field("fixed", 0.4, "unclear clause on page 3") });
    const extraction = await extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams });
    expect(extraction.rateType.status).toBe("ambiguous");
    expect(extraction.rateType.value).toBe("fixed");
  });

  it("treats a missing confidence as full confidence (not automatically ambiguous)", async () => {
    const raw = validRawFields({ loanType: { value: "mortgage" } });
    const extraction = await extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams });
    expect(extraction.loanType.status).toBe("extracted");
  });
});

describe("extractContractFields — wrong data types", () => {
  it("throws ExtractionSchemaError when a field has the wrong type", async () => {
    const raw = validRawFields({ term: field("three-sixty") });
    await expect(
      extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams }),
    ).rejects.toThrow(ExtractionSchemaError);
  });

  it("throws ExtractionSchemaError when principal is not a well-formed Money object", async () => {
    const raw = validRawFields({ principal: field("200000 EUR") });
    await expect(
      extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams }),
    ).rejects.toThrow(ExtractionSchemaError);
  });
});

describe("extractContractFields — chunked (multi-page) extraction", () => {
  function fieldsWith(overrides: Record<string, unknown>) {
    const allNull = Object.fromEntries(Object.keys(validRawFields()).map((k) => [k, field(null)]));
    return { ...allNull, ...overrides };
  }

  const fourPages = [
    { pageNumber: 1, text: "principal is 200,000 EUR" },
    { pageNumber: 2, text: "..." },
    { pageNumber: 3, text: "..." },
    { pageNumber: 4, text: "term is 360 months, fixed rate" },
  ];

  it("merges fields found in different chunks and reports progress per chunk", async () => {
    let call = 0;
    const llm = {
      complete: async () => {
        call += 1;
        return call === 1
          ? JSON.stringify(fieldsWith({ loanType: field("mortgage"), principal: field({ minorUnits: "20000000", currency: "EUR" }) }))
          : JSON.stringify(fieldsWith({ term: field(360), rateType: field("fixed") }));
      },
    };
    const progress: { chunkIndex: number; chunksTotal: number; label: string; fields?: unknown }[] = [];

    const extraction = await extractContractFields({
      contractText: "unused when pages is set",
      pages: fourPages,
      llm,
      ...baseParams,
      onProgress: (p) => {
        progress.push(p);
      },
    });

    // Each chunk reports twice: once before the LLM call (no fields known yet for
    // that chunk), once after merging its fields into the running total so far.
    expect(progress.map((p) => ({ chunkIndex: p.chunkIndex, chunksTotal: p.chunksTotal, label: p.label, hasFields: p.fields !== undefined }))).toEqual([
      { chunkIndex: 0, chunksTotal: 2, label: "Pages 1-3", hasFields: false },
      { chunkIndex: 0, chunksTotal: 2, label: "Pages 1-3", hasFields: true },
      { chunkIndex: 1, chunksTotal: 2, label: "Page 4", hasFields: false },
      { chunkIndex: 1, chunksTotal: 2, label: "Page 4", hasFields: true },
    ]);
    // After the first chunk merges, its fields are already visible in the snapshot.
    expect((progress[1]!.fields as Record<string, { value: unknown }>).loanType?.value).toBe("mortgage");
    // After the second chunk merges, fields from both chunks are present together.
    expect((progress[3]!.fields as Record<string, { value: unknown }>).term?.value).toBe(360);
    expect((progress[3]!.fields as Record<string, { value: unknown }>).loanType?.value).toBe("mortgage");
    expect(extraction.principal.value?.minorUnits).toBe("20000000");
    expect(extraction.term.value).toBe(360);
    expect(extraction.rateType.value).toBe("fixed");
  });

  it("marks a field 'ambiguous' when two chunks returned different values for it", async () => {
    let call = 0;
    const llm = {
      complete: async () => {
        call += 1;
        return call === 1
          ? JSON.stringify(fieldsWith({ term: field(360), loanType: field("mortgage") }))
          : JSON.stringify(fieldsWith({ term: field(300, 0.99), loanType: field("mortgage") }));
      },
    };

    const extraction = await extractContractFields({ contractText: "x", pages: fourPages, llm, ...baseParams });
    expect(extraction.term.status).toBe("ambiguous");
    expect(extraction.term.value).toBe(300); // higher-confidence candidate kept for the reviewer
    expect(extraction.loanType.status).toBe("extracted"); // agreement is not a conflict
  });

  it("skips a chunk that fails and still returns a result merged from the chunks that succeeded", async () => {
    let call = 0;
    const llm = {
      complete: async () => {
        call += 1;
        return call === 1 ? "not valid json" : JSON.stringify(validRawFields());
      },
    };

    const extraction = await extractContractFields({ contractText: "x", pages: fourPages, llm, ...baseParams });
    expect(extraction.principal.value?.minorUnits).toBe("20000000");
  });

  it("throws when every chunk fails", async () => {
    const llm = { complete: async () => "not valid json" };
    await expect(extractContractFields({ contractText: "x", pages: fourPages, llm, ...baseParams })).rejects.toThrow(
      ExtractionParseError,
    );
  });
});

describe("extractContractFields — schema violations", () => {
  it("throws ExtractionSchemaError for an invalid enum value", async () => {
    const raw = validRawFields({ amortizationType: field("bullet") });
    await expect(
      extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams }),
    ).rejects.toThrow(ExtractionSchemaError);
  });

  it("throws ExtractionSchemaError for a malformed date string", async () => {
    const raw = validRawFields({ startDate: field("Feb 1 2026") });
    await expect(
      extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams }),
    ).rejects.toThrow(ExtractionSchemaError);
  });

  it("ExtractionSchemaError carries structured issues for the UI to render", async () => {
    const raw = validRawFields({ term: field(-5) });
    try {
      await extractContractFields({ contractText: "x", llm: llmReturningJson(raw), ...baseParams });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ExtractionSchemaError);
      expect((error as ExtractionSchemaError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe("buildExtractionPrompt", () => {
  // Reads enum options and nullable wrappers straight off the zod schema at runtime, so a
  // zod upgrade that changes those internals would silently drop the allowed-value lists.
  it("spells out the allowed values for enum fields, read from the schema", async () => {
    const { buildExtractionPrompt } = await import("./pipeline.js");
    const prompt = buildExtractionPrompt("contract text");
    expect(prompt).toContain("rateType: MUST be exactly one of: fixed, variable, mixed");
    expect(prompt).toContain('a fixed period followed by a variable period is "mixed"');
    expect(prompt).toContain("loanType: MUST be exactly one of: mortgage, auto, personal, consumer, student, other");
    expect(prompt).toMatch(/paymentFrequency: MUST be exactly one of: [a-z, ]*monthly/);
  });

  it("uses structural hints for non-enum fields", async () => {
    const { buildExtractionPrompt } = await import("./pipeline.js");
    const prompt = buildExtractionPrompt("contract text");
    expect(prompt).toContain('principal: object {"minorUnits"');
    expect(prompt).toContain("--- CONTRACT TEXT START ---\n\ncontract text");
  });
});
