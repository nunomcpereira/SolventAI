"use client";

import { useState } from "react";
import { THEME_COOKIE, type Theme } from "../../lib/theme.js";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Switches the colour theme instantly (sets `data-theme` on <html>) and remembers it
 * in a cookie so the server renders the same theme on the next request — no flash.
 */
export function ThemeSelect({
  initialTheme,
  label,
  options,
  className = "",
  variant = "sidebar",
}: {
  initialTheme: Theme;
  label: string;
  options: { value: Theme; label: string }[];
  className?: string;
  /** "sidebar" follows the rail colours; "form" matches regular form fields. */
  variant?: "sidebar" | "form";
}) {
  const sidebar = variant === "sidebar";
  const [theme, setTheme] = useState<Theme>(initialTheme);

  return (
    <label
      className={`flex flex-col gap-1 ${sidebar ? "text-[11.5px] text-[var(--sidebar-fg)]" : "text-label-sm text-on-surface-variant"} ${className}`}
    >
      {label}
      <select
        name="theme"
        value={theme}
        onChange={(event) => {
          const next = event.target.value as Theme;
          setTheme(next);
          document.documentElement.dataset.theme = next;
          document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        }}
        className={
          sidebar
            ? "w-full rounded-sm border border-[var(--sidebar-border)] !bg-[var(--sidebar-field-bg)] text-[var(--sidebar-strong)] px-2 py-1.5 text-[13px]"
            : "w-full px-3 py-2 border border-outline-variant text-body-md"
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
