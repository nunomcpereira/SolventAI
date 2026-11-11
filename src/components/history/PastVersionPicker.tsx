"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BEFORE_PARAM } from "../../lib/history/versionParam.js";

/** "YYYY-MM-DDTHH:mm" in local time, as <input type="datetime-local"> wants it. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Pick a date and time to see the app as it was then: navigates to `path` (keeping
 * `query`) with `?before=` set to the end of the chosen minute.
 */
export function PastVersionPicker({
  path,
  query,
  initial,
  labels,
}: {
  path: string;
  query?: string;
  /** Pre-filled moment (ISO), e.g. the one being viewed; defaults to now. */
  initial?: string;
  labels: { label: string; go: string };
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => toLocalInput(initial ? new Date(initial) : new Date()));

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      data-past-version-picker
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const local = new Date(value);
        if (Number.isNaN(local.getTime())) return;
        // Include the whole chosen minute.
        const at = new Date(local.getTime() + 60_000).toISOString();
        const params = new URLSearchParams(query ?? "");
        params.set(BEFORE_PARAM, at);
        router.push(`${path}?${params.toString()}`);
      }}
    >
      <label className="flex items-center gap-2 text-label-md text-on-surface-variant">
        {labels.label}
        <input
          type="datetime-local"
          // Server and browser clocks/timezones can differ by a minute at render time.
          suppressHydrationWarning
          value={value}
          max={toLocalInput(new Date())}
          onChange={(e) => setValue(e.target.value)}
          className="border border-outline-variant rounded-sm px-2 py-1 text-body-sm text-on-surface bg-surface-container-lowest"
        />
      </label>
      <button type="submit" className="text-label-md border border-outline-variant rounded-sm px-2.5 py-1 hover:border-primary hover:text-primary transition-colors">
        {labels.go}
      </button>
    </form>
  );
}
