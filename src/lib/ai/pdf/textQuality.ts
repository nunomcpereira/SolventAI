import { type PdfExtractionResult } from "./extractText.js";

export interface TextQualityAssessment {
  /** 0-1 heuristic score; low means the PDF is likely scanned/image-based. */
  score: number;
  likelyScanned: boolean;
  charsPerPage: number;
  alnumRatio: number;
}

const MIN_CHARS_PER_PAGE = 200;
const MIN_ALNUM_RATIO = 0.5;

/**
 * Heuristically assesses whether pdfjs's extracted text is trustworthy prose (a
 * genuine text-layer PDF) or near-empty/garbled output from a scanned image PDF that
 * needs OCR (spec section 25). Two independent signals, both must pass to consider
 * the text "good":
 *  - charsPerPage: scanned PDFs typically extract to near-zero characters since
 *    there's no text layer at all.
 *  - alnumRatio: a genuine text layer is mostly letters/digits/whitespace; extraction
 *    artifacts from malformed encodings tend to be dominated by other characters.
 */
export function assessTextQuality(result: PdfExtractionResult): TextQualityAssessment {
  const charsPerPage = result.pageCount > 0 ? result.fullText.length / result.pageCount : 0;
  const alnumCount = (result.fullText.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const alnumRatio = result.fullText.length > 0 ? alnumCount / result.fullText.length : 0;

  const passesCharsPerPage = charsPerPage >= MIN_CHARS_PER_PAGE;
  const passesAlnumRatio = alnumRatio >= MIN_ALNUM_RATIO;
  const likelyScanned = !passesCharsPerPage || !passesAlnumRatio;

  const charsScore = Math.min(1, charsPerPage / MIN_CHARS_PER_PAGE);
  const alnumScore = Math.min(1, alnumRatio / MIN_ALNUM_RATIO);
  const score = Math.min(charsScore, alnumScore);

  return { score, likelyScanned, charsPerPage, alnumRatio };
}

export function needsOcrFallback(assessment: TextQualityAssessment): boolean {
  return assessment.likelyScanned;
}
