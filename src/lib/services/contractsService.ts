import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import {
  createSqliteContractDocumentRepository,
  createSqliteContractExtractionRepository,
} from "../db/repositories/index.js";
import { type ContractDocument, type ContractDocumentStatus, parseContractDocument } from "../../domain/contracts/contract.js";
import { type ContractExtraction } from "../../domain/contracts/contract.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { resolveContractText, unconfiguredOcrEngine } from "../ai/ocr/index.js";
import { createLlmClient } from "../ai/extraction/llmClient.js";
import { extractContractFields, ExtractionParseError, ExtractionSchemaError } from "../ai/extraction/pipeline.js";
import { getSettings } from "./settingsService.js";
import { emitChange } from "./changeEvents.js";

export async function listContractDocuments(): Promise<ContractDocument[]> {
  const db = await getDb();
  await ensureSeeded(db);
  return createSqliteContractDocumentRepository(db).list();
}

export async function getContractDocument(documentId: string): Promise<ContractDocument | undefined> {
  const db = await getDb();
  return createSqliteContractDocumentRepository(db).findById(documentId);
}

export async function getContractExtraction(documentId: string): Promise<ContractExtraction | undefined> {
  const db = await getDb();
  const all = await createSqliteContractExtractionRepository(db).list();
  return all.find((e) => e.documentId === documentId);
}

/** Drops chunk-progress fields, which only make sense while status is "extracting". */
function withoutChunkProgress(document: ContractDocument, status: ContractDocumentStatus): ContractDocument {
  const { chunkTotal: _chunkTotal, chunkDone: _chunkDone, chunkLabel: _chunkLabel, ...rest } = document;
  return { ...rest, status };
}

function extractionErrorMessage(error: unknown): string {
  return error instanceof ExtractionParseError || error instanceof ExtractionSchemaError
    ? error.message
    : `Extraction failed: ${(error as Error).message}`;
}

/** Parses the PDF and persists an initial "extracting" ContractDocument row. Shared
 * prefix of both the blocking (uploadContract) and backgrounded (beginContractUpload)
 * flows below. */
async function createInitialDocument(fileName: string, bytes: Uint8Array) {
  const db = await getDb();
  const documentId = randomUUID();
  const settings = await getSettings();
  const resolved = await resolveContractText(bytes, unconfiguredOcrEngine);
  const documentRepo = createSqliteContractDocumentRepository(db);
  const document = parseContractDocument({
    id: documentId,
    fileName,
    uploadedAt: IsoDate.fromString(new Date().toISOString().slice(0, 10)).toString(),
    sourceType: resolved.sourceType,
    status: "extracting",
  });
  await documentRepo.save(document);
  emitChange("upload");
  return { db, documentRepo, document, resolved, settings };
}

export interface UploadContractResult {
  document: ContractDocument;
  extraction?: ContractExtraction;
  extractionError?: string;
}

/** Runs the LLM extraction call (chunked, with progress persisted to the document row
 * on every chunk) and persists the final ContractExtraction or failure. Used both by
 * `uploadContract` (awaited) and `beginContractUpload` (fired in the background). */
async function runExtraction(params: {
  document: ContractDocument;
  documentRepo: ReturnType<typeof createSqliteContractDocumentRepository>;
  db: Awaited<ReturnType<typeof getDb>>;
  contractText: string;
  pages: Parameters<typeof extractContractFields>[0]["pages"];
  settings: Awaited<ReturnType<typeof getSettings>>;
}): Promise<UploadContractResult> {
  let document = params.document;
  try {
    const llm = createLlmClient({
      endpoint: params.settings.llmEndpoint,
      allowCloudLlmFallback: params.settings.allowCloudLlmFallback,
    });
    const extraction = await extractContractFields({
      contractText: params.contractText,
      ...(params.pages !== undefined ? { pages: params.pages } : {}),
      llm,
      documentId: document.id,
      extractionId: randomUUID(),
      extractedAt: IsoDate.fromString(new Date().toISOString().slice(0, 10)),
      onProgress: async ({ chunkIndex, chunksTotal, label, fields }) => {
        document = {
          ...document,
          chunkTotal: chunksTotal,
          chunkDone: chunkIndex,
          chunkLabel: label,
          ...(fields ? { partialFields: fields } : {}),
        };
        await params.documentRepo.save(document);
        emitChange("upload");
      },
    });
    await createSqliteContractExtractionRepository(params.db).save(extraction);
    document = withoutChunkProgress(document, "extracted");
    await params.documentRepo.save(document);
    emitChange("upload");
    return { document, extraction };
  } catch (error) {
    document = { ...withoutChunkProgress(document, "failed"), error: extractionErrorMessage(error) };
    await params.documentRepo.save(document);
    emitChange("upload");
    return { document, extractionError: extractionErrorMessage(error) };
  }
}

/**
 * Runs the full spec-section-23 pipeline: PDF -> text extraction -> quality check ->
 * OCR fallback -> (if the local LLM is enabled) extraction -> validated
 * ContractExtraction, persisting a ContractDocument regardless of how far it got. A
 * failed or skipped extraction never blocks the upload — the document is saved with
 * a status that routes the user to manual verification.
 *
 * Blocks until extraction finishes. For a UI that wants to show live progress instead
 * of a single multi-second/minute wait, use `beginContractUpload` + `getContractProgress`.
 */
export async function uploadContract(fileName: string, bytes: Uint8Array): Promise<UploadContractResult> {
  const { documentRepo, document: initialDocument, resolved, settings, db } = await createInitialDocument(fileName, bytes);
  let document = initialDocument;

  if (!settings.llmEnabled) {
    const error = "AI extraction is disabled in settings. Enable Local AI extraction to auto-fill loan fields, or continue manually.";
    document = { ...document, status: "uploaded", error };
    await documentRepo.save(document);
    emitChange("upload");
    return { document, extractionError: error };
  }

  if (resolved.text.trim().length === 0) {
    const error =
      resolved.ocrError ??
      "No readable text was found in this PDF. Configure OCR for scanned documents, or continue by filling the loan form manually.";
    document = { ...document, status: "failed", error };
    await documentRepo.save(document);
    emitChange("upload");
    return { document, extractionError: error };
  }

  return runExtraction({ document, documentRepo, db, contractText: resolved.text, pages: resolved.pages, settings });
}

/**
 * Same pipeline as `uploadContract`, but returns as soon as the document row exists
 * (status "extracting") instead of waiting for the LLM call — the extraction itself
 * runs in the background, persisting chunk progress and partially-merged fields to
 * the document row as it goes. Callers poll `getContractProgress(document.id)` to
 * follow along and pick up the final ContractExtraction once status flips to
 * "extracted"/"failed".
 */
export async function beginContractUpload(fileName: string, bytes: Uint8Array): Promise<{ document: ContractDocument }> {
  const { documentRepo, document: initialDocument, resolved, settings, db } = await createInitialDocument(fileName, bytes);
  let document = initialDocument;

  if (!settings.llmEnabled) {
    document = {
      ...document,
      status: "uploaded",
      error: "AI extraction is disabled in settings. Enable Local AI extraction to auto-fill loan fields, or continue manually.",
    };
    await documentRepo.save(document);
    emitChange("upload");
    return { document };
  }

  if (resolved.text.trim().length === 0) {
    document = {
      ...document,
      status: "failed",
      error:
        resolved.ocrError ??
        "No readable text was found in this PDF. Configure OCR for scanned documents, or continue by filling the loan form manually.",
    };
    await documentRepo.save(document);
    emitChange("upload");
    return { document };
  }

  void runExtraction({ document, documentRepo, db, contractText: resolved.text, pages: resolved.pages, settings });

  return { document };
}

export interface ContractProgressSnapshot {
  documentId: string;
  status: ContractDocumentStatus;
  chunkTotal?: number;
  chunkDone?: number;
  chunkLabel?: string;
  partialFields?: Record<string, { value: unknown; confidence?: number | null }>;
  extraction?: ContractExtraction;
  extractionError?: string;
}

/** Point-in-time snapshot of an in-flight or finished contract extraction, for a
 * polling UI. Returns undefined if no such document exists. */
export async function getContractProgress(documentId: string): Promise<ContractProgressSnapshot | undefined> {
  const document = await getContractDocument(documentId);
  if (!document) return undefined;

  const extraction = document.status === "extracted" ? await getContractExtraction(documentId) : undefined;

  return {
    documentId,
    status: document.status,
    ...(document.chunkTotal !== undefined ? { chunkTotal: document.chunkTotal } : {}),
    ...(document.chunkDone !== undefined ? { chunkDone: document.chunkDone } : {}),
    ...(document.chunkLabel !== undefined ? { chunkLabel: document.chunkLabel } : {}),
    ...(document.partialFields !== undefined ? { partialFields: document.partialFields } : {}),
    ...(extraction !== undefined ? { extraction } : {}),
    ...(document.error !== undefined ? { extractionError: document.error } : {}),
  };
}
