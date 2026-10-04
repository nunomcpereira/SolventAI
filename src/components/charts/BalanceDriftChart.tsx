"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMonthTick } from "../../lib/format.js";

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
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#e0e3e5" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatMonthTick(value, lang)}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#434656"
        />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#434656" width={84} />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString()}
          labelFormatter={(value) => formatMonthTick(String(value), lang)}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="projected"
          name={projectedLabel}
          stroke="#0040e0"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="linear"
          dataKey="actual"
          name={actualLabel}
          stroke="#c2410c"
          strokeWidth={2}
          dot={{ r: 4 }}
          connectNulls
        />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
