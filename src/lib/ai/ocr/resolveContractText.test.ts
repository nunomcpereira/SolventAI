import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveContractText } from "./resolveContractText.js";
import { unconfiguredOcrEngine, type OcrEngine } from "./ocrEngine.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "../../../../fixtures/contracts");

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

const mockOcrEngine: OcrEngine = {
  name: "mock-ocr",
  recognize: async () => [{ pageNumber: 1, text: "OCR-recovered contract text", confidence: 0.8 }],
};

describe("resolveContractText", () => {
  it("uses the text layer directly and never invokes OCR when quality is good", async () => {
    const bytes = loadFixture("sample-text-loan.pdf");
    let called = false;
    const spyEngine: OcrEngine = { name: "spy", recognize: async () => ((called = true), []) };
    const result = await resolveContractText(bytes, spyEngine);
    expect(result.usedOcr).toBe(false);
    expect(result.sourceType).toBe("text");
    expect(result.text).toContain("MORTGAGE LOAN AGREEMENT");
    expect(called).toBe(false);
  });

  it("falls back to OCR when the text layer is empty/scanned", async () => {
    const bytes = loadFixture("sample-blank.pdf");
    const result = await resolveContractText(bytes, mockOcrEngine);
    expect(result.usedOcr).toBe(true);
    expect(result.sourceType).toBe("scanned");
    expect(result.text).toBe("OCR-recovered contract text");
    expect(result.ocrEngineName).toBe("mock-ocr");
  });

  it("never falls back to a cloud service: the unconfigured engine fails closed with a clear error, not silently", async () => {
    const bytes = loadFixture("sample-blank.pdf");
    const result = await resolveContractText(bytes, unconfiguredOcrEngine);
    expect(result.usedOcr).toBe(false);
    expect(result.sourceType).toBe("scanned");
    expect(result.ocrError).toMatch(/No local OCR engine is configured/);
  });
});
