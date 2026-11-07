"use server";

import { revalidatePath } from "next/cache";
import {
  deleteContractDocument,
  retryContractExtraction,
  uploadContract,
} from "../../../lib/services/contractsService.js";

export async function uploadContractAction(lang: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadContract(file.name, bytes);
  revalidatePath(`/${lang}/upload`);
}

function documentIdFrom(formData: FormData): string | undefined {
  const id = formData.get("documentId");
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** Re-runs extraction in the background from the stored contract text. */
export async function retryContractAction(lang: string, formData: FormData): Promise<void> {
  const documentId = documentIdFrom(formData);
  if (!documentId) return;
  await retryContractExtraction(documentId);
  revalidatePath(`/${lang}/upload`);
}

export async function deleteContractAction(lang: string, formData: FormData): Promise<void> {
  const documentId = documentIdFrom(formData);
  if (!documentId) return;
  await deleteContractDocument(documentId);
  revalidatePath(`/${lang}/upload`);
}
