"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { type SimulationProjectionPoint } from "../../lib/services/simulationService.js";
import { formatMonthTick } from "../../lib/format.js";

export interface ChartEventMarker {
  monthInYear: number;
  label: string;
  /** Formatted date this event takes effect on — shown in the details popup. */
  date: string;
  /** Full human-readable description of what this event does (amount, account/loan/income affected). */
  description: string;
  /** Effort rate (DTI) right after this event takes effect, if known — shown in the marker's bubble and popup. */
  effortRatePercent?: string;
  /** Total liquidity that month with vs. without this event's scenario, for the popup's "effect" section. */
  baseLiquidity?: string;
  scenarioLiquidity?: string;
}

function EventBubble({
  viewBox,
  title,
  subtitle,
  onClick,
}: {
  viewBox?: { x?: number; y?: number };
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  if (!viewBox || viewBox.x === undefined || viewBox.y === undefined) return null;
  const x = viewBox.x;
  const lineHeight = 13;
  const paddingY = 6;
  const height = (subtitle ? 2 : 1) * lineHeight + paddingY;
  const width = Math.max(title.length, subtitle?.length ?? 0) * 5.6 + 16;
  const top = viewBox.y - height - 6;

  return (
    // The outer group stays pointer-events="none" — it sits inside the plotted x-range and
    // must never intercept mouse events meant for recharts' own hover/hit-testing overlay
    // beneath it, which otherwise flickers the hover-derived effort-rate reading. Only the
    // visible bubble itself re-enables pointer events (a child CAN override an ancestor's
    // pointer-events), confining the clickable area to exactly what the user sees.
    <g pointerEvents="none">
      <g pointerEvents={onClick ? "auto" : "none"} style={{ cursor: onClick ? "pointer" : undefined }} onClick={onClick}>
        <rect x={x - width / 2} y={top} width={width} height={height} rx={6} fill="#6b21a8" opacity={0.94} />
        <text x={x} y={top + lineHeight - 2} textAnchor="middle" fontSize={10} fontWeight={600} fill="#ffffff">
          {title}
        </text>
        {subtitle ? (
          <text x={x} y={top + lineHeight * 2 - 2} textAnchor="middle" fontSize={10} fill="#ffffff">
            {subtitle}
          </text>
        ) : null}
      </g>
    </g>
  );
}

export function ComparisonChart({
  base,
  scenario,
  baseLabel,
  scenarioLabel,
  incomeLabel,
  loanPaymentsLabel,
  expensesLabel,
  currentDebtLabel,
  ratePercentLabel,
  effortRatePercentLabel,
  events,
  actual,
  actualLabel,
  eventEffectTitle,
  closeLabel,
  onHoverIndex,
  height = 300,
  lang,
}: {
  base: SimulationProjectionPoint[];
  scenario: SimulationProjectionPoint[];
  baseLabel: string;
  scenarioLabel: string;
  incomeLabel: string;
  loanPaymentsLabel: string;
  expensesLabel: string;
  currentDebtLabel: string;
  ratePercentLabel: string;
  effortRatePercentLabel: string;
  events?: ChartEventMarker[];
  /** Sparse real-balance checkpoints, overlaid on the same liquidity axis wherever their
   * date matches a plotted month — see historyReplayService.computeHistoricalProjection. */
  actual?: { date: string; totalLiquidity: string }[];
  actualLabel?: string;
  /** Heading for the event details popup's effect section, and the popup's close button
   * label — the popup only opens (and event markers only become clickable) once both are
   * provided, so callers that don't need it can simply omit them. */
  eventEffectTitle?: string;
  closeLabel?: string;
  /** Called with the hovered period's index into `base`/`scenario` (or `null` when the pointer leaves the chart). */
  onHoverIndex?: (index: number | null) => void;
  height?: number;
  lang: string;
}) {
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const canOpenEventDetails = eventEffectTitle !== undefined && closeLabel !== undefined;
  const selectedEvent = selectedEventIndex !== null ? events?.[selectedEventIndex] : undefined;

  useEffect(() => {
    if (selectedEventIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedEventIndex(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEventIndex]);
  // Real balance checkpoints land on arbitrary calendar days, not the exact monthly
  // period-end dates plotted below — each one is bucketed into the first plotted month
  // whose date it falls on or before (the most recent checkpoint wins within a bucket).
  const sortedActual = [...(actual ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const points = base.map((b, i) => {
    const prevDate = base[i - 1]?.date;
    const bucketed = sortedActual.filter((a) => a.date <= b.date && (prevDate === undefined || a.date > prevDate));
    const actualValue = bucketed.length > 0 ? Number(bucketed[bucketed.length - 1]!.totalLiquidity) : undefined;
    return {
      month: b.monthInYear,
      monthLabel: formatMonthTick(b.date, lang),
      base: Number(b.totalLiquidity),
      scenario: Number(scenario[i]?.totalLiquidity ?? b.totalLiquidity),
      income: Number(scenario[i]?.totalIncome ?? b.totalIncome),
      loanPayments: Number(scenario[i]?.totalDebtService ?? b.totalDebtService),
      expenses: Number(scenario[i]?.totalExpenses ?? b.totalExpenses),
      debt: Number(scenario[i]?.totalOutstandingDebt ?? b.totalOutstandingDebt),
      ratePercent: scenario[i]?.debtServiceRatePercent ?? b.debtServiceRatePercent,
      ...(actualValue !== undefined ? { actual: actualValue } : {}),
    };
  });
  const monthLabelByIndex = new Map(points.map((p) => [p.month, p.monthLabel]));

  return (
    <div className="relative">
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={points}
        margin={{ top: 44, right: 8, bottom: 0, left: 0 }}
        onMouseMove={(state) => {
          if (!onHoverIndex) return;
          const month = Number(state?.activeLabel);
          if (!Number.isFinite(month)) return;
          onHoverIndex(month - 1);
        }}
        onMouseLeave={() => onHoverIndex?.(null)}
      >
        <CartesianGrid stroke="#e0e3e5" vertical={false} />
        <XAxis
          dataKey="month"
          type="category"
          allowDuplicatedCategory={false}
          tickFormatter={(value: number) => monthLabelByIndex.get(value) ?? String(value)}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#434656"
        />
        <YAxis yAxisId="liquidity" tickLine={false} axisLine={false} fontSize={12} stroke="#434656" width={70} />
        <YAxis
          yAxisId="cashflow"
          orientation="right"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#434656"
          width={70}
        />
        <Tooltip
          formatter={(value, name, item) => {
            const formatted = Number(value).toLocaleString();
            if (name === loanPaymentsLabel) {
              const ratePercent = (item?.payload as { ratePercent?: number } | undefined)?.ratePercent;
              if (ratePercent !== undefined) {
                return [`${formatted} (${ratePercentLabel}: ${ratePercent.toFixed(3)}%)`, name];
              }
            }
            return [formatted, name];
          }}
          labelFormatter={(m) => monthLabelByIndex.get(Number(m)) ?? String(m)}
        />
        <Legend />
        {events?.map((event, i) => (
          <ReferenceLine
            key={`${event.monthInYear}-${i}`}
            x={event.monthInYear}
            yAxisId="cashflow"
            stroke="#9333ea"
            strokeDasharray="4 4"
            style={{ pointerEvents: "none" }}
            label={
              <EventBubble
                title={event.label}
                {...(event.effortRatePercent !== undefined
                  ? { subtitle: `${effortRatePercentLabel}: ${Number(event.effortRatePercent).toFixed(0)}%` }
                  : {})}
                {...(canOpenEventDetails ? { onClick: () => setSelectedEventIndex(i) } : {})}
              />
            }
          />
        ))}
        <Line yAxisId="liquidity" type="monotone" dataKey="base" name={baseLabel} stroke="#747688" strokeWidth={2} dot={false} />
        <Line yAxisId="liquidity" type="monotone" dataKey="scenario" name={scenarioLabel} stroke="#0040e0" strokeWidth={2} dot={false} />
        <Line yAxisId="liquidity" type="monotone" dataKey="debt" name={currentDebtLabel} stroke="#db2777" strokeWidth={2} dot={false} />
        {actualLabel ? (
          <Line yAxisId="liquidity" type="linear" dataKey="actual" name={actualLabel} stroke="#c2410c" strokeWidth={2} dot={{ r: 4 }} connectNulls />
        ) : null}
        <Line yAxisId="cashflow" type="monotone" dataKey="income" name={incomeLabel} stroke="#0891b2" strokeWidth={2} dot={false} />
        <Line yAxisId="cashflow" type="monotone" dataKey="loanPayments" name={loanPaymentsLabel} stroke="#c2410c" strokeWidth={2} dot={false} />
        <Line yAxisId="cashflow" type="monotone" dataKey="expenses" name={expensesLabel} stroke="#15803d" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
    {selectedEvent && closeLabel ? (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
        onClick={() => setSelectedEventIndex(null)}
      >
        <div
          className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-2xl flex flex-col gap-stack-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-headline-sm text-on-surface">{selectedEvent.label}</h4>
            <button
              type="button"
              onClick={() => setSelectedEventIndex(null)}
              aria-label={closeLabel}
              className="w-7 h-7 shrink-0 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                close
              </span>
            </button>
          </div>
          <span className="text-label-sm text-on-surface-variant">{selectedEvent.date}</span>
          <p className="text-body-md text-on-surface">{selectedEvent.description}</p>
          {selectedEvent.effortRatePercent !== undefined ||
          (selectedEvent.baseLiquidity !== undefined && selectedEvent.scenarioLiquidity !== undefined) ? (
            <div className="border-t border-outline-variant pt-3 mt-1 flex flex-col gap-2">
              <h5 className="text-label-md text-on-surface font-semibold">{eventEffectTitle}</h5>
              {selectedEvent.effortRatePercent !== undefined ? (
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{effortRatePercentLabel}</span>
                  <span className="text-on-surface">{Number(selectedEvent.effortRatePercent).toFixed(0)}%</span>
                </div>
              ) : null}
              {selectedEvent.baseLiquidity !== undefined ? (
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{baseLabel}</span>
                  <span className="text-on-surface">{Number(selectedEvent.baseLiquidity).toLocaleString()}</span>
                </div>
              ) : null}
              {selectedEvent.scenarioLiquidity !== undefined ? (
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{scenarioLabel}</span>
                  <span className="text-on-surface">{Number(selectedEvent.scenarioLiquidity).toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    ) : null}
    </div>
  );
}
