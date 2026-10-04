"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_COOKIE_NAME } from "../lib/services/db.js";
import { listTenants, createDemoTenant } from "../lib/services/tenantService.js";

export async function switchTenantAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId || !/^[a-zA-Z0-9_-]+$/.test(tenantId)) return;
  if (!listTenants().some((t) => t.id === tenantId)) return;

  const store = await cookies();
  store.set(TENANT_COOKIE_NAME, tenantId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function createDemoTenantAction(): Promise<void> {
  const tenantId = await createDemoTenant();
  const store = await cookies();
  store.set(TENANT_COOKIE_NAME, tenantId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
