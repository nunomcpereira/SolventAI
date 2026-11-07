export const THEMES = ["classic", "ledger"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "classic";
export const THEME_COOKIE = "solvent_theme";

export function parseTheme(value: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}
