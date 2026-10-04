import { describe, expect, it } from "vitest";
import { chunkContractPages } from "./chunking.js";

function pages(count: number) {
  return Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1, text: `page ${i + 1} text` }));
}

describe("chunkContractPages", () => {
  it("groups pages into fixed-size ranges with human-readable labels", () => {
    const chunks = chunkContractPages(pages(7), 3);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ index: 0, total: 3, label: "Pages 1-3" });
    expect(chunks[1]).toMatchObject({ index: 1, total: 3, label: "Pages 4-6" });
    expect(chunks[2]).toMatchObject({ index: 2, total: 3, label: "Page 7" });
    expect(chunks[0]!.text).toContain("page 1 text");
    expect(chunks[0]!.text).toContain("page 3 text");
  });

  it("returns a single full-document chunk when there are no pages", () => {
    const chunks = chunkContractPages([]);
    expect(chunks).toEqual([{ index: 0, total: 1, label: "Full document", text: "" }]);
  });

  it("returns a single chunk when the whole document fits in one group", () => {
    const chunks = chunkContractPages(pages(2), 3);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, total: 1, label: "Pages 1-2" });
  });
});
