import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractPdfText } from "./extractText.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "../../../../fixtures/contracts");

describe("extractPdfText", () => {
  it("extracts real text content from a text-layer PDF", async () => {
    const bytes = new Uint8Array(readFileSync(join(fixturesDir, "sample-text-loan.pdf")));
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBe(1);
    expect(result.fullText).toContain("MORTGAGE LOAN AGREEMENT");
    expect(result.fullText).toContain("200,000.00");
    expect(result.fullText).toContain("3.5%");
  });

  it("returns near-empty text for a page with no text layer", async () => {
    const bytes = new Uint8Array(readFileSync(join(fixturesDir, "sample-blank.pdf")));
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBe(1);
    expect(result.fullText.trim()).toBe("");
  });

  it("returns per-page text entries matching pageCount", async () => {
    const bytes = new Uint8Array(readFileSync(join(fixturesDir, "sample-text-loan.pdf")));
    const result = await extractPdfText(bytes);
    expect(result.pages).toHaveLength(result.pageCount);
    expect(result.pages[0]!.pageNumber).toBe(1);
  });
});
