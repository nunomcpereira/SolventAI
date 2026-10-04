const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_COLOR: Record<"healthy" | "warning" | "danger", string> = {
  healthy: "#059669",
  warning: "#f59e0b",
  danger: "#dc2626",
};

/**
 * Circular progress ring showing the effort rate, matching the Stitch mockups'
 * gauge (financial_dashboard_updated's inline SVG technique, ported as a reusable
 * component). Pure presentation — `percent` is the engine-computed effort rate
 * (spec section 17), this component only draws it.
 */
export function EffortGauge({
  percent,
  tone,
  sizePx = 192,
}: {
  percent: number;
  tone: "healthy" | "warning" | "danger";
  sizePx?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e0e3e5" strokeWidth="12" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={TONE_COLOR[tone]}
          strokeWidth="12"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display-lg-mobile text-on-background">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}
