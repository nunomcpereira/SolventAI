"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMonthTick } from "../../lib/format.js";

export interface LiquidityChartPoint {
  month: number;
  date: string;
  totalLiquidity: string;
}

/**
 * Renders engine-computed liquidity projection data. This component performs no
 * financial calculation of its own — `totalLiquidity` per point is already the
 * output of engine/metrics, converted to a plain number only for the chart's y-axis.
 */
export function LiquidityChart({
  data,
  actual,
  actualLabel,
  projectedLabel,
  trend,
  trendLabel,
  lang,
}: {
  data: LiquidityChartPoint[];
  /** Sparse real-balance checkpoints, bucketed into whichever plotted month they fall on
   * or before — see historyReplayService.computeHistoricalProjection. */
  actual?: { date: string; totalLiquidity: string }[];
  actualLabel?: string;
  /** Legend label for the projected line — only shown (and needed) once `actualLabel` is
   * also passed, so the legend doesn't read a bare "value" next to it. */
  projectedLabel?: string;
  /** Savings-trend line, keyed by the same dates as `data` (see engine/metrics/savingsTrend). */
  trend?: { date: string; totalLiquidity: string }[];
  trendLabel?: string | undefined;
  lang: string;
}) {
  const sortedActual = [...(actual ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const trendByDate = new Map((trend ?? []).map((t) => [t.date, Number(t.totalLiquidity)]));
  const points = data.map((d, i) => {
    const prevDate = data[i - 1]?.date;
    const bucketed = sortedActual.filter((a) => a.date <= d.date && (prevDate === undefined || a.date > prevDate));
    const actualValue = bucketed.length > 0 ? Number(bucketed[bucketed.length - 1]!.totalLiquidity) : undefined;
    const trendValue = trendByDate.get(d.date);
    return {
      ...d,
      value: Number(d.totalLiquidity),
      ...(actualValue !== undefined ? { actual: actualValue } : {}),
      ...(trendValue !== undefined ? { trend: trendValue } : {}),
    };
  });
  const monthLabelByIndex = new Map(points.map((p) => [p.month, formatMonthTick(p.date, lang)]));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#434656" width={70} />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString()}
          labelFormatter={(m) => monthLabelByIndex.get(Number(m)) ?? String(m)}
        />
        {actualLabel || trendLabel ? <Legend /> : null}
        <Line type="monotone" dataKey="value" {...(projectedLabel ? { name: projectedLabel } : {})} stroke="#0040e0" strokeWidth={2} dot={false} />
        {actualLabel ? (
          <Line type="linear" dataKey="actual" name={actualLabel} stroke="#c2410c" strokeWidth={2} dot={{ r: 4 }} connectNulls />
        ) : null}
        {trendLabel && trendByDate.size > 0 ? (
          <Line type="linear" dataKey="trend" name={trendLabel} stroke="#15803d" strokeWidth={2} strokeDasharray="6 4" dot={false} />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
