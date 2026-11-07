import { beforeEach, describe, expect, it, vi } from "vitest";

// One shared in-memory DB per test file (db.ts caches connections by path).
vi.hoisted(() => {
  process.env["SOLVENT_DB_PATH"] = ":memory:";
});

vi.mock("server-only", () => ({}));
vi.mock("./seed.js", () => ({ ensureSeeded: async () => {} }));
vi.mock("./settingsService.js", () => ({
  getSettings: async () => ({ llmEnabled: true, llmEndpoint: "http://localhost:1/v1", allowCloudLlmFallback: false }),
}));
vi.mock("../ai/extraction/llmClient.js", () => ({ createLlmClient: () => ({}) }));
vi.mock("../ai/ocr/index.js", () => ({
  unconfiguredOcrEngine: {},
  resolveContractText: async () => ({
    text: "Contrato de mútuo com hipoteca. Capital: 200.000 EUR.",
    pages: [{ pageNumber: 1, text: "Contrato de mútuo com hipoteca. Capital: 200.000 EUR." }],
    sourceType: "text",
  }),
}));

const extractMock = vi.hoisted(() => vi.fn());
vi.mock("../ai/extraction/pipeline.js", () => ({
  extractContractFields: extractMock,
  ExtractionParseError: class extends Error {},
  ExtractionSchemaError: class extends Error {},
}));

import { getDb } from "./db.js";
import {
  beginContractUpload,
  deleteContractDocument,
  getContractExtraction,
  listContractDocuments,
  retryContractExtraction,
  uploadContract,
} from "./contractsService.js";
import { createSqliteContractDocumentRepository, createSqliteContractExtractionRepository } from "../db/repositories/index.js";
import {
  INTERRUPTED_EXTRACTION_ERROR,
  parseContractDocument,
  parseContractExtraction,
} from "../../domain/contracts/contract.js";
import { IsoDate } from "../../engine/dates/isoDate.js";

const field = <T,>(value: T) => ({ value, status: "extracted" as const, confidence: 0.9 });
const missing = () => ({ value: null, status: "missing" as const });

function fakeExtraction(params: { documentId: string; extractionId: string }) {
  return parseContractExtraction({
    id: params.extractionId,
    documentId: params.documentId,
    extractedAt: "2026-11-07",
    loanType: field("mortgage"),
    principal: field({ minorUnits: "20000000", currency: "EUR" }),
    currency: field("EUR"),
    term: field(360),
    startDate: field("2024-07-07"),
    maturityDate: missing(),
    rateType: field("mixed"),
    fixedRate: field("0.03"),
    fixedRatePeriods: field(36),
    index: field("EURIBOR_6M"),
    indexRate: missing(),
    spread: field("0.007"),
    resetFrequency: missing(),
    amortizationType: field("french"),
    paymentFrequency: field("monthly"),
    dayCountConvention: field("actual/360"),
    fees: field([]),
    insurance: field([]),
    prepaymentRules: field([]),
  });
}

const pdf = (marker: string) => new TextEncoder().encode(`%PDF-1.7 ${marker}`);

async function clearTables() {
  const db = await getDb();
  db.exec("DELETE FROM contract_extractions; DELETE FROM contract_documents;");
}

/** Waits for fire-and-forget background extraction to settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await clearTables();
  extractMock.mockReset();
  extractMock.mockImplementation(async (params: { documentId: string; extractionId: string }) => fakeExtraction(params));
});

describe("contract uploads", () => {
  it("re-uploading the same file returns the existing document instead of a duplicate", async () => {
    const first = await uploadContract("contract.pdf", pdf("a"));
    const second = await uploadContract("contract (1).pdf", pdf("a"));

    expect(second.document.id).toBe(first.document.id);
    expect(second.extraction?.id).toBe(first.extraction?.id);
    expect(await listContractDocuments()).toHaveLength(1);
    expect(extractMock).toHaveBeenCalledTimes(1);
  });

  it("a different file gets its own document", async () => {
    await uploadContract("a.pdf", pdf("a"));
    await uploadContract("b.pdf", pdf("b"));
    expect(await listContractDocuments()).toHaveLength(2);
  });

  it("re-uploading a file whose extraction failed reuses the row and runs again", async () => {
    extractMock.mockRejectedValueOnce(new Error("LLM unreachable"));
    const failed = await uploadContract("contract.pdf", pdf("a"));
    expect(failed.document.status).toBe("failed");

    const retried = await uploadContract("contract.pdf", pdf("a"));
    expect(retried.document.id).toBe(failed.document.id);
    expect(retried.document.status).toBe("extracted");
    expect(retried.document.error).toBeUndefined();
    expect(await listContractDocuments()).toHaveLength(1);
  });

  it("records a heartbeat while extracting in the background", async () => {
    let release: () => void = () => {};
    extractMock.mockImplementationOnce(
      (params: { documentId: string; extractionId: string }) =>
        new Promise((resolve) => {
          release = () => resolve(fakeExtraction(params));
        }),
    );
    const { document } = await beginContractUpload("contract.pdf", pdf("a"));
    expect(document.status).toBe("extracting");
    expect(document.progressAt).toBeDefined();

    // Still alive: listing must not mark it interrupted.
    const [listed] = await listContractDocuments();
    expect(listed?.status).toBe("extracting");

    release();
    await flush();
    const [done] = await listContractDocuments();
    expect(done?.status).toBe("extracted");
  });
});

describe("interrupted extractions", () => {
  it("marks an 'extracting' row with no heartbeat as failed and retryable", async () => {
    const db = await getDb();
    await createSqliteContractDocumentRepository(db).save(
      parseContractDocument({
        id: "legacy",
        fileName: "old.pdf",
        uploadedAt: "2026-08-09",
        sourceType: "text",
        status: "extracting",
        chunkTotal: 9,
        chunkDone: 0,
        chunkLabel: "Pages 1-3",
      }),
    );

    const [doc] = await listContractDocuments();
    expect(doc?.status).toBe("failed");
    expect(doc?.error).toBe(INTERRUPTED_EXTRACTION_ERROR);
    expect(doc?.chunkTotal).toBeUndefined();
  });

  it("marks a run whose last heartbeat is older than the timeout as failed", async () => {
    const db = await getDb();
    await createSqliteContractDocumentRepository(db).save(
      parseContractDocument({
        id: "hung",
        fileName: "hung.pdf",
        uploadedAt: "2026-11-07",
        sourceType: "text",
        status: "extracting",
        progressAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      }),
    );
    const [doc] = await listContractDocuments();
    expect(doc?.status).toBe("failed");
  });
});

describe("retryContractExtraction", () => {
  it("re-runs from the stored text and replaces the previous extraction", async () => {
    const { document } = await uploadContract("contract.pdf", pdf("a"));
    const before = await getContractExtraction(document.id);

    const result = await retryContractExtraction(document.id);
    expect(result?.document.status).toBe("extracting");
    await flush();

    const db = await getDb();
    const extractions = (await createSqliteContractExtractionRepository(db).list()).filter(
      (e) => e.documentId === document.id,
    );
    expect(extractions).toHaveLength(1);
    expect(extractions[0]?.id).not.toBe(before?.id);
    expect(extractMock).toHaveBeenCalledTimes(2);
    expect(extractMock.mock.calls[1]?.[0].contractText).toContain("Capital: 200.000 EUR");
  });

  it("explains that a re-upload is needed when the text wasn't kept", async () => {
    const db = await getDb();
    await createSqliteContractDocumentRepository(db).save(
      parseContractDocument({
        id: "no-source",
        fileName: "old.pdf",
        uploadedAt: IsoDate.fromString("2026-08-09").toString(),
        sourceType: "text",
        status: "failed",
        error: "Extraction failed: timeout",
      }),
    );
    const result = await retryContractExtraction("no-source");
    expect(result?.document.status).toBe("failed");
    expect(result?.document.error).toMatch(/Upload the PDF again/);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("returns undefined for an unknown document", async () => {
    expect(await retryContractExtraction("nope")).toBeUndefined();
  });
});

describe("deleteContractDocument", () => {
  it("removes the document and its extraction", async () => {
    const { document } = await uploadContract("contract.pdf", pdf("a"));
    await deleteContractDocument(document.id);
    expect(await listContractDocuments()).toHaveLength(0);
    expect(await getContractExtraction(document.id)).toBeUndefined();
  });
});
