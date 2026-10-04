/**
 * OCR must remain fully local (spec section 25/27) — no cloud OCR API call is ever
 * acceptable here, even as a fallback. This module defines the pluggable interface
 * and the decision logic; it does NOT bundle a specific OCR engine, because a real
 * one (e.g. Tesseract) needs trained-language data on disk, which is an operator
 * install-time concern, not something to fetch from a CDN at runtime.
 */
export interface OcrPageResult {
  pageNumber: number;
  text: string;
  /** 0-1 engine-reported confidence for this page, if the engine provides one. */
  confidence?: number;
}

export interface OcrEngine {
  /** Human-readable engine name, for logging/audit (e.g. "tesseract-local"). */
  readonly name: string;
  /** Takes the raw PDF bytes; the engine implementation owns page rasterization. */
  recognize(pdfBytes: Uint8Array): Promise<OcrPageResult[]>;
}

/**
 * Fails closed: no OCR engine is configured by default, so a scanned PDF surfaces an
 * explicit "needs manual verification" state (spec section 2.5) rather than silently
 * skipping extraction or, worse, reaching out to an external OCR service.
 */
export const unconfiguredOcrEngine: OcrEngine = {
  name: "unconfigured",
  recognize(_pdfBytes: Uint8Array) {
    return Promise.reject(
      new Error(
        "No local OCR engine is configured. Install and wire up a local engine (e.g. Tesseract with " +
          "locally-stored trained-language data) and provide it via the OcrEngine interface — " +
          "SolventAI never falls back to a cloud OCR service.",
      ),
    );
  },
};
