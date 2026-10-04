export interface ContractPage {
  pageNumber: number;
  text: string;
}

export interface ContractChunk {
  /** 0-based position in the chunk sequence. */
  index: number;
  total: number;
  /** Human-readable section reference shown to the user while extraction runs, e.g. "Pages 4-6". */
  label: string;
  text: string;
}

/**
 * Groups a PDF's per-page text into fixed-size page ranges so a long contract is sent
 * to the local LLM as several small prompts instead of one giant one — this both
 * keeps each prompt within the local model's context window and gives the caller a
 * natural progress signal ("Analyzing pages 4-6 of 18") instead of one multi-minute
 * black box.
 */
export function chunkContractPages(pages: ContractPage[], pagesPerChunk = 3): ContractChunk[] {
  if (pages.length === 0) {
    return [{ index: 0, total: 1, label: "Full document", text: "" }];
  }

  const groups: ContractPage[][] = [];
  for (let i = 0; i < pages.length; i += pagesPerChunk) {
    groups.push(pages.slice(i, i + pagesPerChunk));
  }

  return groups.map((group, index) => {
    const first = group[0]!.pageNumber;
    const last = group[group.length - 1]!.pageNumber;
    return {
      index,
      total: groups.length,
      label: first === last ? `Page ${first}` : `Pages ${first}-${last}`,
      text: group.map((p) => p.text).join("\n"),
    };
  });
}
