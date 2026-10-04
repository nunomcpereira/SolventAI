import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Append-only audit trail of every client<->local-LLM exchange during contract
 * extraction: the prompt sent, the raw response received, and the outcome of
 * validating that response against the extraction schema. Contract text can be
 * sensitive, so the log path defaults under the same data directory as the DB
 * (spec: local-only, never leaves the machine) rather than a system temp dir.
 */
const LOG_PATH = process.env["SOLVENT_LLM_LOG_PATH"] ?? "./data/logs/llm-extraction.jsonl";

/** Which chunk of a (possibly multi-chunk) contract this log entry belongs to. */
export interface LogChunkInfo {
  index: number;
  total: number;
  label: string;
}

export type LlmExchangeLogEntry =
  | { type: "request"; timestamp: string; documentId: string; extractionId: string; prompt: string; chunk?: LogChunkInfo }
  | {
      type: "response";
      timestamp: string;
      documentId: string;
      extractionId: string;
      rawResponse: string;
      chunk?: LogChunkInfo;
    }
  | { type: "parse_error"; timestamp: string; documentId: string; extractionId: string; error: string; chunk?: LogChunkInfo }
  | {
      type: "schema_validation_error";
      timestamp: string;
      documentId: string;
      extractionId: string;
      issues: { path: string; message: string }[];
      chunk?: LogChunkInfo;
    }
  | { type: "validated"; timestamp: string; documentId: string; extractionId: string };

let logDirEnsured: Promise<void> | undefined;

async function ensureLogDir(): Promise<void> {
  logDirEnsured ??= mkdir(dirname(LOG_PATH), { recursive: true }).then(() => undefined);
  await logDirEnsured;
}

/**
 * Never throws: a logging failure (e.g. read-only filesystem) must not take down
 * contract extraction, which is the actual user-facing feature.
 */
export async function logLlmExchange(entry: LlmExchangeLogEntry): Promise<void> {
  try {
    await ensureLogDir();
    await appendFile(LOG_PATH, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // logging is best-effort
  }
}
