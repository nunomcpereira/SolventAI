"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BEFORE_PARAM, parseBefore } from "../../lib/history/versionParam.js";
import { formatDayHeading, formatTime } from "../../lib/format.js";

/**
 * Shown while a page is rendered as a past version (`?before=`): says which moment it is,
 * links back to the current version, and blocks form submits — the past copy is read-only.
 */
export function PastVersionBanner({
  lang,
  labels,
}: {
  lang: string;
  labels: { viewing: string; readOnly: string; backToCurrent: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const before = parseBefore(searchParams.get(BEFORE_PARAM));

  useEffect(() => {
    if (!before) return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("submit", block, true);
    return () => document.removeEventListener("submit", block, true);
  }, [before]);

  if (!before) return null;
  const current = new URLSearchParams(searchParams.toString());
  current.delete(BEFORE_PARAM);
  const currentHref = `${pathname}${current.size > 0 ? `?${current.toString()}` : ""}`;
  const when = `${formatDayHeading(before, lang)}, ${formatTime(before, lang)}`;

  return (
    <div
      role="status"
      data-testid="past-version-banner"
      className="mb-stack-md flex flex-wrap items-center justify-between gap-2 border border-primary bg-primary/10 rounded-sm px-3 py-2"
    >
      <p className="text-body-md text-on-surface">
        <span className="material-symbols-outlined align-middle mr-1.5" style={{ fontSize: "18px" }} aria-hidden>
          history
        </span>
        {labels.viewing.replace("{date}", when)} <span className="text-on-surface-variant">{labels.readOnly}</span>
      </p>
      {/* A full load, not client navigation: forms on the page keep uncontrolled values otherwise. */}
      <a href={currentHref} className="text-label-md text-primary hover:underline">
        {labels.backToCurrent}
      </a>
    </div>
  );
}
