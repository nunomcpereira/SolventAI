/**
 * PDF text extraction via pdfjs-dist's legacy Node build — no native bindings, no
 * canvas/rasterization dependency, runs fully offline (spec sections 23/27).
 */
export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  pageCount: number;
  pages: PdfPageText[];
  fullText: string;
}

export async function extractPdfText(data: Uint8Array): Promise<PdfExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;

  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ pageNumber, text });
  }

  return {
    pageCount: doc.numPages,
    pages,
    fullText: pages.map((p) => p.text).join("\n"),
  };
}
