"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { type LoanChartPoint } from "../../lib/services/loansPageService.js";
import { CHART, AXIS_PROPS, TOOLTIP_PROPS, LEGEND_PROPS, compactTick } from "./chartTheme.js";

/**
 * Stacked interest-vs-principal chart for one loan's amortization schedule. Purely a
 * rendering of engine-computed data (see loansPageService.buildChartData) — no
 * financial calculation happens here.
 */
export function LoanAmortizationChart({ data, interestLabel, principalLabel }: { data: LoanChartPoint[]; interestLabel: string; principalLabel: string }) {
  const points = data.map((d) => ({ label: d.label, interest: Number(d.interest), principal: Number(d.principal) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} tickFormatter={compactTick} width={48} />
        <Tooltip {...TOOLTIP_PROPS} formatter={(value) => Number(value).toLocaleString()} />
        <Legend {...LEGEND_PROPS} />
        <Area type="monotone" dataKey="principal" name={principalLabel} stackId="1" stroke={CHART.accent} fill={CHART.accent} fillOpacity={0.75} />
        <Area type="monotone" dataKey="interest" name={interestLabel} stackId="1" stroke={CHART.actual} fill={CHART.actual} fillOpacity={0.55} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
