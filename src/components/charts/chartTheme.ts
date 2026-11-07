/**
 * Chart palette. Values are CSS variables defined per theme in globals.css
 * (`:root` = classic, `:root[data-theme="ledger"]`), so charts follow the theme switch
 * without re-rendering.
 */
export const CHART = {
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  ink: "var(--chart-ink)",
  muted: "var(--chart-muted)",
  accent: "var(--chart-accent)",
  actual: "var(--chart-actual)",
  trend: "var(--chart-trend)",
  debt: "var(--chart-debt)",
  income: "var(--chart-income)",
  expenses: "var(--chart-expenses)",
  loanPayments: "var(--chart-loan-payments)",
  event: "var(--chart-event)",
  onEvent: "var(--chart-on-event)",
  healthy: "var(--chart-healthy)",
  warning: "var(--chart-warning)",
  danger: "var(--chart-danger)",
  dotFill: "var(--chart-dot-fill)",
} as const;

export const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  stroke: CHART.axis,
  fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
} as const;

export const TOOLTIP_PROPS = {
  contentStyle: {
    background: "var(--chart-tooltip-bg)",
    border: "1px solid var(--chart-tooltip-border)",
    borderRadius: 2,
    fontSize: 12,
    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
    boxShadow: "none",
  },
  labelStyle: { color: "var(--chart-tooltip-label)", marginBottom: 4 },
  cursor: { stroke: "var(--chart-cursor)", strokeWidth: 1, strokeDasharray: "2 3" },
} as const;

export const LEGEND_PROPS = {
  iconType: "plainline" as const,
  iconSize: 14,
  wrapperStyle: { fontSize: 12, color: "var(--chart-tooltip-label)", paddingTop: 8 },
};

/** Compact y-axis ticks: 120000 → 120k, 1500000 → 1.5M. */
export function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${+(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(value);
}
