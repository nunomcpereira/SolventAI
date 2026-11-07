import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { ensureSeeded } from "./seed.js";
import {
  createSqliteContractDocumentRepository,
  createSqliteContractExtractionRepository,
} from "../db/repositories/index.js";
import {
  deleteContractExtractionsForDocument,
  findContractDocumentByHash,
  getContractSource,
  saveContractSource,
  type ContractSource,
} from "../db/repositories/sqliteContractRepository.js";
import {
  type ContractDocument,
  type ContractDocumentStatus,
  INTERRUPTED_EXTRACTION_ERROR,
  isExtractionStale,
  parseContractDocument,
} from "../../domain/contracts/contract.js";
import { type ContractExtraction } from "../../domain/contracts/contract.js";
import { IsoDate } from "../../engine/dates/isoDate.js";
import { resolveContractText, unconfiguredOcrEngine } from "../ai/ocr/index.js";
import { createLlmClient } from "../ai/extraction/llmClient.js";
import { extractContractFields, ExtractionParseError, ExtractionSchemaError } from "../ai/extraction/pipeline.js";
import { getSettings } from "./settingsService.js";
import { emitChange } from "./changeEvents.js";

type Db = Awaited<ReturnType<typeof getDb>>;
type DocumentRepo = ReturnType<typeof createSqliteContractDocumentRepository>;
type Settings = Awaited<ReturnType<typeof getSettings>>;

const AI_DISABLED_ERROR =
  "AI extraction is disabled in settings. Enable Local AI extraction to auto-fill loan fields, or continue manually.";
const NO_TEXT_ERROR =
  "No readable text was found in this PDF. Configure OCR for scanned documents, or continue by filling the loan form manually.";
const SOURCE_NOT_KEPT_ERROR =
  "This document was uploaded before retries were supported, so its text wasn't kept. Upload the PDF again to re-run extraction.";

function nowIso(): string {
  return new Date().toISOString();
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Drops chunk-progress fields, which only make sense while status is "extracting". */
function withoutChunkProgress(document: ContractDocument, status: ContractDocumentStatus): ContractDocument {
  const { chunkTotal: _chunkTotal, chunkDone: _chunkDone, chunkLabel: _chunkLabel, ...rest } = document;
  return { ...rest, status };
}

/** A document about to (re-)run extraction: no stale error or partial results from a previous run. */
function freshExtractingDocument(document: ContractDocument): ContractDocument {
  const { error: _error, partialFields: _partialFields, ...rest } = withoutChunkProgress(document, "extracting");
  return { ...rest, status: "extracting", progressAt: nowIso() };
}

function extractionErrorMessage(error: unknown): string {
  return error instanceof ExtractionParseError || error instanceof ExtractionSchemaError
    ? error.message
    : `Extraction failed: ${(error as Error).message}`;
}

/**
 * Background extraction is an in-process promise: a restart (or a hung local LLM) leaves the
 * row "extracting" forever. Any such row without a recent heartbeat is flipped to "failed"
 * with a retryable error, so the UI never shows a spinner that can't finish.
 */
async function reconcileStale(repo: DocumentRepo, document: ContractDocument, now: Date): Promise<ContractDocument> {
  if (!isExtractionStale(document, now)) return document;
  const failed: ContractDocument = { ...withoutChunkProgress(document, "failed"), error: INTERRUPTED_EXTRACTION_ERROR };
  await repo.save(failed);
  emitChange("upload");
  return failed;
}

export async function listContractDocuments(): Promise<ContractDocument[]> {
  const db = await getDb();
  await ensureSeeded(db);
  const repo = createSqliteContractDocumentRepository(db);
  const now = new Date();
  const documents = await repo.list();
  return Promise.all(documents.map((document) => reconcileStale(repo, document, now)));
}

export async function getContractDocument(documentId: string): Promise<ContractDocument | undefined> {
  const db = await getDb();
  const repo = createSqliteContractDocumentRepository(db);
  const document = await repo.findById(documentId);
  return document ? reconcileStale(repo, document, new Date()) : undefined;
}

export async function getContractExtraction(documentId: string): Promise<ContractExtraction | undefined> {
  const db = await getDb();
  const all = await createSqliteContractExtractionRepository(db).list();
  return all.find((e) => e.documentId === documentId);
}

/** Whether a document's text was kept, i.e. whether "Retry" can work without a re-upload. */
export async function canRetryContractExtraction(documentId: string): Promise<boolean> {
  const db = await getDb();
  return getContractSource(db, documentId) !== undefined;
}

/** Why extraction can't run for this document right now, or undefined if it can. */
function preflightError(settings: Settings, source: ContractSource, ocrError?: string): string | undefined {
  if (!settings.llmEnabled) return AI_DISABLED_ERROR;
  if (source.text.trim().length === 0) return ocrError ?? NO_TEXT_ERROR;
  return undefined;
}

type PreparedUpload =
  | { kind: "existing"; document: ContractDocument }
  | {
      kind: "ready";
      db: Db;
      documentRepo: DocumentRepo;
      document: ContractDocument;
      source: ContractSource;
      settings: Settings;
      blockedReason?: string;
    };

/**
 * Parses the PDF and persists an "extracting" ContractDocument row plus its text.
 * Re-uploading the same file (same SHA-256) never creates a duplicate row: a finished or
 * still-running document is returned as-is, and a failed/interrupted one is reused and re-run.
 */
async function prepareUpload(fileName: string, bytes: Uint8Array): Promise<PreparedUpload> {
  const db = await getDb();
  const documentRepo = createSqliteContractDocumentRepository(db);
  const settings = await getSettings();
  const contentHash = sha256Hex(bytes);

  const found = findContractDocumentByHash(db, contentHash);
  const existing = found ? await reconcileStale(documentRepo, found, new Date()) : undefined;
  if (existing && (existing.status === "extracted" || existing.status === "extracting")) {
    return { kind: "existing", document: existing };
  }

  const resolved = await resolveContractText(bytes, unconfiguredOcrEngine);
  const source: ContractSource = { text: resolved.text, pages: resolved.pages };
  const base: ContractDocument = existing
    ? { ...existing, fileName, sourceType: resolved.sourceType }
    : parseContractDocument({
        id: randomUUID(),
        fileName,
        uploadedAt: IsoDate.fromString(new Date().toISOString().slice(0, 10)).toString(),
        sourceType: resolved.sourceType,
        status: "extracting",
        contentHash,
      });
  const document = freshExtractingDocument(base);
  await documentRepo.save(document);
  saveContractSource(db, document.id, source);
  emitChange("upload");

  const blockedReason = preflightError(settings, source, resolved.ocrError);
  return {
    kind: "ready",
    db,
    documentRepo,
    document,
    source,
    settings,
    ...(blockedReason !== undefined ? { blockedReason } : {}),
  };
}

/** Persists the reason extraction didn't run ("uploaded" when AI is off, "failed" otherwise). */
async function markBlocked(documentRepo: DocumentRepo, document: ContractDocument, reason: string): Promise<ContractDocument> {
  const status: ContractDocumentStatus = reason === AI_DISABLED_ERROR ? "uploaded" : "failed";
  const blocked = { ...withoutChunkProgress(document, status), error: reason };
  await documentRepo.save(blocked);
  emitChange("upload");
  return blocked;
}

export interface UploadContractResult {
  document: ContractDocument;
  extraction?: ContractExtraction;
  extractionError?: string;
}

/** Runs the LLM extraction call (chunked, with progress + heartbeat persisted to the document
 * row on every chunk) and persists the final ContractExtraction or failure. Used awaited by
 * `uploadContract` and fired in the background by `beginContractUpload` / retries. */
async function runExtraction(params: {
  document: ContractDocument;
  documentRepo: DocumentRepo;
  db: Db;
  source: ContractSource;
  settings: Settings;
}): Promise<UploadContractResult> {
  let document = params.document;
  try {
    const llm = createLlmClient({
      endpoint: params.settings.llmEndpoint,
      allowCloudLlmFallback: params.settings.allowCloudLlmFallback,
    });
    const extraction = await extractContractFields({
      contractText: params.source.text,
      ...(params.source.pages.length > 0 ? { pages: params.source.pages } : {}),
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
          progressAt: nowIso(),
          ...(fields ? { partialFields: fields } : {}),
        };
        await params.documentRepo.save(document);
        emitChange("upload");
      },
    });
    // A retry replaces the previous result rather than leaving two extractions for one document.
    deleteContractExtractionsForDocument(params.db, document.id);
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

async function existingResult(document: ContractDocument): Promise<UploadContractResult> {
  const extraction = document.status === "extracted" ? await getContractExtraction(document.id) : undefined;
  return { document, ...(extraction ? { extraction } : {}) };
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
  const prepared = await prepareUpload(fileName, bytes);
  if (prepared.kind === "existing") return existingResult(prepared.document);
  if (prepared.blockedReason !== undefined) {
    const document = await markBlocked(prepared.documentRepo, prepared.document, prepared.blockedReason);
    return { document, extractionError: prepared.blockedReason };
  }
  return runExtraction(prepared);
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
  const prepared = await prepareUpload(fileName, bytes);
  if (prepared.kind === "existing") return { document: prepared.document };
  if (prepared.blockedReason !== undefined) {
    return { document: await markBlocked(prepared.documentRepo, prepared.document, prepared.blockedReason) };
  }
  void runExtraction(prepared);
  return { document: prepared.document };
}

/**
 * Re-runs extraction for a failed, interrupted or AI-disabled document from its stored text,
 * in the background. A run that is still alive is left alone.
 */
export async function retryContractExtraction(documentId: string): Promise<{ document: ContractDocument } | undefined> {
  const db = await getDb();
  const documentRepo = createSqliteContractDocumentRepository(db);
  const found = await documentRepo.findById(documentId);
  if (!found) return undefined;
  const current = await reconcileStale(documentRepo, found, new Date());
  if (current.status === "extracting") return { document: current };

  const source = getContractSource(db, documentId);
  if (!source) {
    const document = { ...withoutChunkProgress(current, "failed"), error: SOURCE_NOT_KEPT_ERROR };
    await documentRepo.save(document);
    emitChange("upload");
    return { document };
  }

  const settings = await getSettings();
  const document = freshExtractingDocument(current);
  const blockedReason = preflightError(settings, source);
  if (blockedReason !== undefined) {
    return { document: await markBlocked(documentRepo, document, blockedReason) };
  }
  await documentRepo.save(document);
  emitChange("upload");
  void runExtraction({ document, documentRepo, db, source, settings });
  return { document };
}

/** Removes an uploaded document and its extraction. Loans created from it keep their data;
 * their contract link is cleared by the foreign key (ON DELETE SET NULL). */
export async function deleteContractDocument(documentId: string): Promise<void> {
  const db = await getDb();
  await createSqliteContractDocumentRepository(db).delete(documentId);
  emitChange("upload");
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
