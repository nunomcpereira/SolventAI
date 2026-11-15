"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BEFORE_PARAM, parseBefore } from "../../lib/history/versionParam.js";
import { formatDayHeading, formatTime } from "../../lib/format.js";
import { PastVersionPicker } from "./PastVersionPicker.js";

/**
 * Shown while a page is rendered as a past version (`?before=`): says which moment it is,
 * links back to the current version, and blocks form submits — the past copy is read-only.
 * Links to other pages of the app keep `?before=`, so the whole app can be browsed as it
 * was at that moment; only "back to current" leaves it.
 */
export function PastVersionBanner({
  lang,
  labels,
}: {
  lang: string;
  labels: { viewing: string; readOnly: string; backToCurrent: string; pickLabel: string; pickGo: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const before = parseBefore(searchParams.get(BEFORE_PARAM));

  useEffect(() => {
    if (!before) return;
    const block = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement && event.target.hasAttribute("data-past-version-picker"))) event.preventDefault();
    };
    // Capture on document runs before React's own (root) listeners, so Next's <Link>
    // never navigates without the param.
    const keepBefore = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.dataset["leavePastVersion"] !== undefined) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith(`/${lang}/`) || url.searchParams.has(BEFORE_PARAM)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return; // in-page anchor
      event.preventDefault();
      event.stopPropagation();
      url.searchParams.set(BEFORE_PARAM, before);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("submit", block, true);
    document.addEventListener("click", keepBefore, true);
    return () => {
      document.removeEventListener("submit", block, true);
      document.removeEventListener("click", keepBefore, true);
    };
  }, [before, lang, router]);

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
      <PastVersionPicker
        key={before}
        path={pathname}
        query={current.toString()}
        initial={new Date(Date.parse(before) - 60_000).toISOString()}
        labels={{ label: labels.pickLabel, go: labels.pickGo }}
      />
      {/* A full load, not client navigation: forms on the page keep uncontrolled values otherwise. */}
      <a href={currentHref} data-leave-past-version className="text-label-md text-primary hover:underline">
        {labels.backToCurrent}
      </a>
    </div>
  );
}
