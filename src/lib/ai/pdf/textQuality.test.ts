import { describe, expect, it } from "vitest";
import { assessTextQuality, needsOcrFallback } from "./textQuality.js";
import { type PdfExtractionResult } from "./extractText.js";

function result(fullText: string, pageCount = 1): PdfExtractionResult {
  return {
    pageCount,
    pages: [{ pageNumber: 1, text: fullText }],
    fullText,
  };
}

describe("assessTextQuality", () => {
  it("scores real prose highly and does not flag it as scanned", () => {
    const prose = "This mortgage agreement sets out the terms of the loan. ".repeat(10);
    const assessment = assessTextQuality(result(prose));
    expect(assessment.likelyScanned).toBe(false);
    expect(assessment.score).toBeGreaterThan(0.5);
  });

  it("flags empty text as likely scanned", () => {
    const assessment = assessTextQuality(result(""));
    expect(assessment.likelyScanned).toBe(true);
    expect(assessment.score).toBe(0);
  });

  it("flags very short text (well below the per-page threshold) as likely scanned", () => {
    const assessment = assessTextQuality(result("a b c"));
    expect(assessment.likelyScanned).toBe(true);
  });

  it("flags text dominated by non-alphanumeric noise as likely scanned even if long", () => {
    const noise = "#$%^&*()_+-=[]{}|;:,.<>?/~`".repeat(20);
    const assessment = assessTextQuality(result(noise));
    expect(assessment.likelyScanned).toBe(true);
    expect(assessment.alnumRatio).toBeLessThan(0.5);
  });

  it("needsOcrFallback mirrors likelyScanned", () => {
    const good = assessTextQuality(result("Real contract text goes here and is long enough. ".repeat(10)));
    const bad = assessTextQuality(result(""));
    expect(needsOcrFallback(good)).toBe(false);
    expect(needsOcrFallback(bad)).toBe(true);
  });

  it("handles zero pages without dividing by zero", () => {
    const assessment = assessTextQuality(result("", 0));
    expect(assessment.charsPerPage).toBe(0);
    expect(Number.isFinite(assessment.score)).toBe(true);
  });
});
