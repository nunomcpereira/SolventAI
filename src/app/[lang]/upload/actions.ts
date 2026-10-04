"use server";

import { revalidatePath } from "next/cache";
import { uploadContract } from "../../../lib/services/contractsService.js";

export async function uploadContractAction(lang: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  await uploadContract(file.name, bytes);
  revalidatePath(`/${lang}/upload`);
}
