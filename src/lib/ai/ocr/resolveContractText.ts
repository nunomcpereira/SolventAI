import { extractPdfText, type PdfExtractionResult, type PdfPageText } from "../pdf/extractText.js";
import { assessTextQuality, needsOcrFallback, type TextQualityAssessment } from "../pdf/textQuality.js";
import { type OcrEngine } from "./ocrEngine.js";

export interface ResolvedContractText {
  text: string;
  /** Per-page text, in page order — lets extraction chunk a long contract instead of sending it whole. */
  pages: PdfPageText[];
  sourceType: "text" | "scanned";
  usedOcr: boolean;
  quality: TextQualityAssessment;
  ocrEngineName?: string;
  /** Set only when OCR was needed but the configured engine failed (e.g. unconfigured). */
  ocrError?: string;
}

/**
 * Runs the extraction pipeline described in spec section 25:
 *   PDF -> text extraction -> quality assessment -> OCR fallback if needed.
 * If the text layer looks good, OCR is never invoked (keeps things fast and avoids
 * depending on an OCR engine being configured at all for the common case). If OCR is
 * needed but fails (e.g. no local engine configured), this does NOT throw — it
 * returns whatever text extraction found (possibly empty) with `ocrError` set, so the
 * caller can route the document to manual verification rather than silently losing
 * the upload.
 */
export async function resolveContractText(pdfBytes: Uint8Array, ocrEngine: OcrEngine): Promise<ResolvedContractText> {
  const extraction: PdfExtractionResult = await extractPdfText(pdfBytes);
  const quality = assessTextQuality(extraction);

  if (!needsOcrFallback(quality)) {
    return { text: extraction.fullText, pages: extraction.pages, sourceType: "text", usedOcr: false, quality };
  }

  try {
    const ocrPages = await ocrEngine.recognize(pdfBytes);
    const text = ocrPages.map((p) => p.text).join("\n");
    return {
      text,
      pages: ocrPages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
      sourceType: "scanned",
      usedOcr: true,
      quality,
      ocrEngineName: ocrEngine.name,
    };
  } catch (error) {
    return {
      text: extraction.fullText,
      pages: extraction.pages,
      sourceType: "scanned",
      usedOcr: false,
      quality,
      ocrError: (error as Error).message,
    };
  }
}
