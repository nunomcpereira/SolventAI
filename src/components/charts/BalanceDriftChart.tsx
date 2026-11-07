"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatDate, formatMonthTick, monthStartsBetween } from "../../lib/format.js";
import { CHART, AXIS_PROPS, TOOLTIP_PROPS, LEGEND_PROPS, compactTick } from "./chartTheme.js";

export interface BalanceDriftPoint {
  date: string;
  balance: string;
}

/**
 * Compares a dense, purely-computed `projected` balance series (from configured
 * income/expenses/loan payments, replayed using the config that was actually in effect
 * at each point in time — see historyReplayService) against the sparse `actual` series
 * of real balance corrections the user has entered. The two are deliberately never
 * reconciled — the gap between them is what this chart exists to show.
 */
export function BalanceDriftChart({
  projected,
  actual,
  projectedLabel,
  actualLabel,
  lang,
}: {
  projected: BalanceDriftPoint[];
  actual: BalanceDriftPoint[];
  projectedLabel: string;
  actualLabel: string;
  lang: string;
}) {
  const byDate = new Map<string, { date: string; projected?: number; actual?: number }>();
  for (const p of projected) {
    byDate.set(p.date, { ...byDate.get(p.date), date: p.date, projected: Number(p.balance) });
  }
  for (const a of actual) {
    byDate.set(a.date, { ...byDate.get(a.date), date: a.date, actual: Number(a.balance) });
  }
  const points = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ ...p, t: Date.parse(p.date) }));
  // A real time axis: points sit at their actual dates (sparse balance checks no longer get
  // spread evenly), and there is exactly one tick per month instead of one per data point —
  // which used to print the same month twice when two points fell in it.
  const firstDate = points[0]?.date;
  const lastDate = points[points.length - 1]?.date;
  const ticks = firstDate && lastDate ? monthStartsBetween(firstDate, lastDate).map((d) => Date.parse(d)) : [];
  const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickFormatter={(value: number) => formatMonthTick(isoOf(value), lang)}
          {...AXIS_PROPS}
        />
        <YAxis {...AXIS_PROPS} tickFormatter={compactTick} width={52} />
        <Tooltip
          {...TOOLTIP_PROPS}
          formatter={(value) => Number(value).toLocaleString()}
          labelFormatter={(value) => formatDate(isoOf(Number(value)), lang)}
        />
        <Legend {...LEGEND_PROPS} />
        <Line
          type="monotone"
          dataKey="projected"
          name={projectedLabel}
          stroke={CHART.ink}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="linear"
          dataKey="actual"
          name={actualLabel}
          stroke={CHART.actual}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 1.5, fill: CHART.dotFill }}
          connectNulls
        />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
