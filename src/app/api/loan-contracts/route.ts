import { NextResponse } from "next/server";
import { beginContractUpload } from "../../../lib/services/contractsService.js";

/** Kicks off contract upload + extraction and returns immediately once the document
 * row exists (status "extracting") — extraction itself runs in the background.
 * Poll GET /api/loan-contracts/[id] for progress. */
export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { document } = await beginContractUpload(file.name, bytes);

  return NextResponse.json({ documentId: document.id, status: document.status });
}
