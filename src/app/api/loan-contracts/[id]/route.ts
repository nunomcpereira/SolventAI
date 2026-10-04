import { NextResponse } from "next/server";
import { getContractProgress } from "../../../../lib/services/contractsService.js";
import { serializeContractExtraction } from "../../../../domain/contracts/contract.js";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const snapshot = await getContractProgress(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    documentId: snapshot.documentId,
    status: snapshot.status,
    chunkTotal: snapshot.chunkTotal,
    chunkDone: snapshot.chunkDone,
    chunkLabel: snapshot.chunkLabel,
    partialFields: snapshot.partialFields,
    extraction: snapshot.extraction ? serializeContractExtraction(snapshot.extraction) : undefined,
    extractionError: snapshot.extractionError,
  });
}
