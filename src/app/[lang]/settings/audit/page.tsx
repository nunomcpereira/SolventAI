import Link from "next/link";
import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../../../lib/i18n/locales.js";
import { getDictionary } from "../../../../lib/i18n/getDictionary.js";
import { getAuditLog, parseAuditType } from "../../../../lib/services/auditService.js";
import { AuditLogList } from "../../../../components/audit/AuditLogList.js";
import { ENTITY_TYPES } from "../../../../domain/history/entityHistory.js";

const PAGE_SIZE = 100;

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ type?: string; limit?: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const query = await searchParams;
  const type = parseAuditType(query.type);
  const limit = Math.max(PAGE_SIZE, Math.min(5000, Math.trunc(Number(query.limit ?? PAGE_SIZE)) || PAGE_SIZE));
  const audit = await getAuditLog({ ...(type ? { type } : {}), limit });

  const href = (next: { type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (next.type) qs.set("type", next.type);
    if (next.limit && next.limit > PAGE_SIZE) qs.set("limit", String(next.limit));
    const s = qs.toString();
    return `/${lang}/settings/audit${s ? `?${s}` : ""}`;
  };

  const filters: { value?: string; label: string }[] = [
    { label: dict.audit.all },
    ...ENTITY_TYPES.map((t) => ({ value: t, label: dict.audit.types[t] })),
  ];

  return (
    <div className="flex flex-col gap-stack-lg max-w-4xl">
      <div className="page-head border-b border-on-surface pb-5">
        <Link href={`/${lang}/settings#audit`} className="text-label-md text-primary hover:underline">
          ← {dict.audit.backToSettings}
        </Link>
        <h1 className="text-display-lg-mobile md:text-display-lg text-on-surface mt-2">{dict.audit.title}</h1>
        <p className="text-body-lg text-on-surface-variant mt-1">{dict.audit.subtitle}</p>
      </div>

      <nav aria-label={dict.audit.title} className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (f.value ?? undefined) === type;
          return (
            <Link
              key={f.value ?? "all"}
              href={href(f.value ? { type: f.value } : {})}
              aria-current={active ? "page" : undefined}
              className={`text-label-md px-2.5 py-1 rounded-sm border transition-colors ${
                active
                  ? "border-on-surface bg-on-surface text-surface"
                  : "border-outline-variant text-on-surface-variant hover:border-on-surface hover:text-on-surface"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <AuditLogList events={audit.events} names={audit.names} dict={dict} lang={lang} />

      {audit.total > audit.events.length ? (
        <Link
          href={href({ ...(type ? { type } : {}), limit: limit + PAGE_SIZE })}
          className="self-start text-label-md text-primary border-b border-primary/40 hover:border-primary pb-0.5"
        >
          {dict.audit.showMore} ({audit.total - audit.events.length})
        </Link>
      ) : null}

      <p className="text-label-sm text-on-surface-variant">{dict.audit.trackingNote}</p>
    </div>
  );
}
