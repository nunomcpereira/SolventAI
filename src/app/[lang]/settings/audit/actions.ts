"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { restoreAuditVersion } from "../../../../lib/services/auditService.js";
import { emitChange } from "../../../../lib/services/changeEvents.js";

/** Only back to the audit log or the settings page's audit section, never an arbitrary URL. */
function safeReturnTo(lang: string, value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith(`/${lang}/settings`) && !raw.startsWith("//") ? raw : `/${lang}/settings/audit`;
}

export async function restoreAuditVersionAction(lang: string, formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  const returnTo = safeReturnTo(lang, formData.get("returnTo"));
  const restored = await restoreAuditVersion(eventId);

  // A restore can touch any page (a loan, an account and its projections, settings…).
  revalidatePath(`/${lang}`, "layout");
  emitChange("accounts");
  emitChange("loans");

  const [path, hash] = returnTo.split("#");
  const url = new URL(path!, "http://local");
  url.searchParams.set("restored", restored ? "ok" : "error");
  redirect(`${url.pathname}${url.search}${hash ? `#${hash}` : ""}`);
}
