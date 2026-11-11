"use client";

import { useState } from "react";
import type { ImpactKey, ImpactRow } from "../../lib/audit/impact.js";

const TONE: Record<ImpactRow["tone"], string> = {
  better: "text-status-healthy",
  worse: "text-status-danger",
  same: "text-on-surface-variant",
};

/**
 * "Impact on key figures": loaded only when opened (it recomputes the dashboard twice),
 * then shows each figure before → after with the signed difference.
 */
export function AuditImpact({
  eventId,
  lang,
  labels,
}: {
  eventId: string;
  lang: string;
  labels: { title: string; loading: string; failed: string; unchanged: string; metrics: Record<ImpactKey, string> };
}) {
  const [state, setState] = useState<"idle" | "loading" | "failed" | ImpactRow[]>("idle");

  const load = async () => {
    if (state !== "idle" && state !== "failed") return;
    setState("loading");
    try {
      const res = await fetch(`/api/audit-impact/${encodeURIComponent(eventId)}?lang=${lang}`);
      if (!res.ok) throw new Error(String(res.status));
      setState(((await res.json()) as { rows: ImpactRow[] }).rows);
    } catch {
      setState("failed");
    }
  };

  const changed = Array.isArray(state) ? state.filter((r) => r.tone !== "same" || r.delta) : [];

  return (
    <details className="mt-1.5" data-testid="audit-impact" onToggle={(e) => (e.currentTarget.open ? void load() : undefined)}>
      <summary className="cursor-pointer select-none text-label-sm text-primary w-fit">{labels.title}</summary>
      <div className="mt-2 border-l border-outline-variant pl-3">
        {state === "loading" || state === "idle" ? (
          <p className="text-body-sm text-on-surface-variant">{labels.loading}</p>
        ) : state === "failed" ? (
          <p className="text-body-sm text-status-danger">{labels.failed}</p>
        ) : changed.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">{labels.unchanged}</p>
        ) : (
          <dl className="flex flex-col gap-0.5">
            {changed.map((row) => (
              <div key={row.key} className="text-body-sm grid grid-cols-1 sm:grid-cols-[minmax(9rem,14rem)_1fr] gap-x-3">
                <dt className="text-on-surface-variant">{labels.metrics[row.key]}</dt>
                <dd className="min-w-0 break-words">
                  <span className="text-on-surface-variant">{row.before}</span>
                  <span aria-hidden className="mx-1.5 text-outline">→</span>
                  <span className="text-on-surface font-medium">{row.after}</span>
                  {row.delta ? <span className={`ml-2 font-mono text-label-sm ${TONE[row.tone]}`}>{row.delta}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}
