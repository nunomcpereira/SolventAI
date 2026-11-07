import { CHART } from "./chartTheme.js";

const TONE_COLOR: Record<"healthy" | "warning" | "danger", string> = {
  healthy: CHART.healthy,
  warning: CHART.warning,
  danger: CHART.danger,
};

/** Threshold marks drawn on the scale — the same cut-offs the pages use to pick a tone. */
const THRESHOLDS = [30, 45];

/**
 * Linear meter for a 0–100% ratio (effort rate, solvency risk): the figure set large in
 * mono, then a hairline scale with the 30% / 45% cut-offs ticked and the reading filled
 * in. Pure presentation — `percent` is engine-computed; this only draws it.
 * Fixed height so it can sit in hover-driven panels without reflowing them.
 */
export function EffortGauge({
  percent,
  tone,
}: {
  percent: number;
  tone: "healthy" | "warning" | "danger";
  /** Kept for call-site compatibility; the meter is fluid-width. */
  sizePx?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = TONE_COLOR[tone];

  return (
    <div className="w-full self-stretch h-[68px] flex flex-col justify-end gap-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)}>
      <div className="figure text-[34px] leading-none text-on-surface">
        {Math.round(clamped)}
        <span className="text-[18px] text-on-surface-variant ml-0.5">%</span>
      </div>
      <div className="relative h-[10px]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-outline" />
        <div className="absolute left-0 top-[2px] h-[6px]" style={{ width: `${clamped}%`, backgroundColor: color }} />
        {THRESHOLDS.map((t) => (
          <div key={t} className="absolute top-0 h-[10px] w-px bg-on-surface" style={{ left: `${t}%` }} />
        ))}
        <div className="absolute right-0 top-0 h-[10px] w-px bg-outline" />
      </div>
    </div>
  );
}
