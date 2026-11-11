import { getAuditImpact } from "../../../../lib/services/auditService.js";
import { compareImpact } from "../../../../lib/audit/impact.js";
import { getDictionary } from "../../../../lib/i18n/getDictionary.js";
import { SUPPORTED_LANGUAGES, type Language } from "../../../../lib/i18n/locales.js";

export const dynamic = "force-dynamic";

/** GET ?lang=: the headline figures before vs after one audit event, formatted for display. */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  const requested = new URL(request.url).searchParams.get("lang") ?? "en";
  const lang: Language = (SUPPORTED_LANGUAGES as readonly string[]).includes(requested) ? (requested as Language) : "en";
  const dict = getDictionary(lang);

  try {
    const impact = await getAuditImpact(eventId);
    if (!impact) return Response.json({ error: "not-found" }, { status: 404 });
    const rows = compareImpact(
      impact.before,
      impact.after,
      lang,
      (n) => dict.audit.impactMonths.replace("{count}", String(n)),
      dict.audit.impactNoRunwayLimit,
    );
    return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("audit impact failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
