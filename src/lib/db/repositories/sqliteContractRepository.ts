import { type Database } from "../client.js";
import {
  type ContractDocument,
  type ContractDocumentRepository,
  type SerializedContractDocument,
  parseContractDocument,
  serializeContractDocument,
  type ContractExtraction,
  type ContractExtractionRepository,
  type ContractExtractionInput,
  parseContractExtraction,
  serializeContractExtraction,
} from "../../../domain/contracts/contract.js";

interface ContractDocumentRow {
  id: string;
  file_name: string;
  uploaded_at: string;
  source_type: string;
  page_count: number | null;
  status: string;
  chunk_total: number | null;
  chunk_done: number | null;
  chunk_label: string | null;
  partial_fields_json: string | null;
  error: string | null;
  progress_at: string | null;
  content_hash: string | null;
}

function rowToDocument(row: ContractDocumentRow): ContractDocument {
  const serialized: SerializedContractDocument = {
    id: row.id,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    sourceType: row.source_type as SerializedContractDocument["sourceType"],
    ...(row.page_count !== null ? { pageCount: row.page_count } : {}),
    status: row.status as SerializedContractDocument["status"],
    ...(row.chunk_total !== null ? { chunkTotal: row.chunk_total } : {}),
    ...(row.chunk_done !== null ? { chunkDone: row.chunk_done } : {}),
    ...(row.chunk_label !== null ? { chunkLabel: row.chunk_label } : {}),
    ...(row.partial_fields_json !== null ? { partialFields: JSON.parse(row.partial_fields_json) } : {}),
    ...(row.error !== null ? { error: row.error } : {}),
    ...(row.progress_at !== null ? { progressAt: row.progress_at } : {}),
    ...(row.content_hash !== null ? { contentHash: row.content_hash } : {}),
  };
  return parseContractDocument(serialized);
}

export function createSqliteContractDocumentRepository(db: Database): ContractDocumentRepository {
  return {
    async findById(id: string): Promise<ContractDocument | undefined> {
      const row = db.prepare("SELECT * FROM contract_documents WHERE id = ?").get(id) as ContractDocumentRow | undefined;
      return row ? rowToDocument(row) : undefined;
    },

    async list(): Promise<ContractDocument[]> {
      const rows = db
        .prepare("SELECT * FROM contract_documents ORDER BY uploaded_at")
        .all() as unknown as ContractDocumentRow[];
      return rows.map(rowToDocument);
    },

    async save(doc: ContractDocument): Promise<void> {
      const s = serializeContractDocument(doc);
      db.prepare(
        `INSERT INTO contract_documents (id, file_name, uploaded_at, source_type, page_count, status, chunk_total, chunk_done, chunk_label, partial_fields_json, error, progress_at, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           file_name = excluded.file_name,
           uploaded_at = excluded.uploaded_at,
           source_type = excluded.source_type,
           page_count = excluded.page_count,
           status = excluded.status,
           chunk_total = excluded.chunk_total,
           chunk_done = excluded.chunk_done,
           chunk_label = excluded.chunk_label,
           partial_fields_json = excluded.partial_fields_json,
           error = excluded.error,
           progress_at = excluded.progress_at,
           content_hash = excluded.content_hash`,
      ).run(
        s.id,
        s.fileName,
        s.uploadedAt,
        s.sourceType,
        s.pageCount ?? null,
        s.status,
        s.chunkTotal ?? null,
        s.chunkDone ?? null,
        s.chunkLabel ?? null,
        s.partialFields !== undefined ? JSON.stringify(s.partialFields) : null,
        s.error ?? null,
        s.progressAt ?? null,
        s.contentHash ?? null,
      );
    },

    async delete(id: string): Promise<void> {
      db.prepare("DELETE FROM contract_documents WHERE id = ?").run(id);
    },
  };
}

/** Parsed contract text kept next to the document so an interrupted or failed extraction can
 * be retried without the user uploading the PDF again. Stored outside ContractDocument on
 * purpose: it is large, and nothing but the extraction pipeline needs it. */
export interface ContractSource {
  text: string;
  pages: { pageNumber: number; text: string }[];
}

export function saveContractSource(db: Database, documentId: string, source: ContractSource): void {
  db.prepare("UPDATE contract_documents SET source_text = ?, source_pages_json = ? WHERE id = ?").run(
    source.text,
    JSON.stringify(source.pages),
    documentId,
  );
}

export function getContractSource(db: Database, documentId: string): ContractSource | undefined {
  const row = db
    .prepare("SELECT source_text, source_pages_json FROM contract_documents WHERE id = ?")
    .get(documentId) as { source_text: string | null; source_pages_json: string | null } | undefined;
  if (!row || row.source_text === null) return undefined;
  return {
    text: row.source_text,
    pages: row.source_pages_json !== null ? (JSON.parse(row.source_pages_json) as ContractSource["pages"]) : [],
  };
}

/** Most recently uploaded document with this content hash, if any. */
export function findContractDocumentByHash(db: Database, contentHash: string): ContractDocument | undefined {
  const row = db
    .prepare("SELECT * FROM contract_documents WHERE content_hash = ? ORDER BY uploaded_at DESC, rowid DESC LIMIT 1")
    .get(contentHash) as ContractDocumentRow | undefined;
  return row ? rowToDocument(row) : undefined;
}

export function deleteContractExtractionsForDocument(db: Database, documentId: string): void {
  db.prepare("DELETE FROM contract_extractions WHERE document_id = ?").run(documentId);
}

interface ContractExtractionRow {
  id: string;
  document_id: string;
  extracted_at: string;
  fields_json: string;
}

const MISSING_FIELD = { value: null, status: "missing" as const };

/** Fields added to ContractExtraction after some rows were already persisted — backfilled
 * as "missing" here rather than via a data migration, so old fields_json blobs (which
 * predate these keys entirely) still parse instead of failing schema validation. */
const BACKFILLED_EXTRACTION_FIELDS = ["fixedRatePeriods", "indexRate"] as const;

function rowToExtraction(row: ContractExtractionRow): ContractExtraction {
  const fields = JSON.parse(row.fields_json) as Omit<ContractExtractionInput, "id" | "documentId" | "extractedAt">;
  const backfilled = Object.fromEntries(
    BACKFILLED_EXTRACTION_FIELDS.filter((key) => !(key in fields)).map((key) => [key, MISSING_FIELD]),
  );
  return parseContractExtraction({
    id: row.id,
    documentId: row.document_id,
    extractedAt: row.extracted_at,
    ...fields,
    ...backfilled,
  });
}

export function createSqliteContractExtractionRepository(db: Database): ContractExtractionRepository {
  return {
    async findById(id: string): Promise<ContractExtraction | undefined> {
      const row = db.prepare("SELECT * FROM contract_extractions WHERE id = ?").get(id) as
        | ContractExtractionRow
        | undefined;
      return row ? rowToExtraction(row) : undefined;
    },

    async list(): Promise<ContractExtraction[]> {
      const rows = db
        .prepare("SELECT * FROM contract_extractions ORDER BY extracted_at")
        .all() as unknown as ContractExtractionRow[];
      return rows.map(rowToExtraction);
    },

    async save(extraction: ContractExtraction): Promise<void> {
      const s = serializeContractExtraction(extraction);
      const { id, documentId, extractedAt, ...fields } = s;
      db.prepare(
        `INSERT INTO contract_extractions (id, document_id, extracted_at, fields_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           document_id = excluded.document_id,
           extracted_at = excluded.extracted_at,
           fields_json = excluded.fields_json`,
      ).run(id, documentId, extractedAt, JSON.stringify(fields));
    },

    async delete(id: string): Promise<void> {
      db.prepare("DELETE FROM contract_extractions WHERE id = ?").run(id);
    },
  };
}
