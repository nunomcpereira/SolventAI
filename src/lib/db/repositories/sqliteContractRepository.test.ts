import { describe, expect, it } from "vitest";
import { openDatabase } from "../client.js";
import {
  createSqliteContractDocumentRepository,
  createSqliteContractExtractionRepository,
} from "./sqliteContractRepository.js";
import { parseContractDocument, parseContractExtraction } from "../../../domain/contracts/contract.js";

function validDocument(id = "doc-1") {
  return parseContractDocument({
    id,
    fileName: "mortgage.pdf",
    uploadedAt: "2026-01-01",
    sourceType: "text",
    pageCount: 5,
    status: "uploaded",
  });
}

function extractedField<T>(value: T) {
  return { value, status: "extracted" as const, confidence: 0.9 };
}
function missingField() {
  return { value: null, status: "missing" as const };
}

function validExtraction(id = "ext-1", documentId = "doc-1") {
  return parseContractExtraction({
    id,
    documentId,
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
    fees: extractedField([]),
    insurance: extractedField([]),
    prepaymentRules: extractedField([]),
  });
}

describe("SqliteContractDocumentRepository", () => {
  it("round-trips a document including optional pageCount", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteContractDocumentRepository(db);
    const doc = validDocument();
    await repo.save(doc);
    expect(await repo.findById("doc-1")).toEqual(doc);
  });

  it("delete removes the document", async () => {
    const db = openDatabase(":memory:");
    const repo = createSqliteContractDocumentRepository(db);
    await repo.save(validDocument());
    await repo.delete("doc-1");
    expect(await repo.findById("doc-1")).toBeUndefined();
  });
});

describe("SqliteContractExtractionRepository", () => {
  it("round-trips an extraction with all its extracted-field metadata intact", async () => {
    const db = openDatabase(":memory:");
    const docRepo = createSqliteContractDocumentRepository(db);
    const extRepo = createSqliteContractExtractionRepository(db);
    await docRepo.save(validDocument());
    const extraction = validExtraction();
    await extRepo.save(extraction);

    const found = await extRepo.findById("ext-1");
    expect(found).toEqual(extraction);
    expect(found?.index.status).toBe("missing");
    expect(found?.principal.confidence).toBe(0.9);
  });

  it("list returns all saved extractions", async () => {
    const db = openDatabase(":memory:");
    const docRepo = createSqliteContractDocumentRepository(db);
    const extRepo = createSqliteContractExtractionRepository(db);
    await docRepo.save(validDocument());
    await extRepo.save(validExtraction("ext-1"));
    await extRepo.save(validExtraction("ext-2"));
    const all = await extRepo.list();
    expect(all.map((e) => e.id).sort()).toEqual(["ext-1", "ext-2"]);
  });
});
