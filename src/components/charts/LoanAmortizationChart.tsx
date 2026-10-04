"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { type LoanChartPoint } from "../../lib/services/loansPageService.js";

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
        <CartesianGrid stroke="#e0e3e5" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#434656" interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#434656" width={64} />
        <Tooltip formatter={(value) => Number(value).toLocaleString()} />
        <Legend />
        <Area type="monotone" dataKey="principal" name={principalLabel} stackId="1" stroke="#0040e0" fill="#0040e0" fillOpacity={0.5} />
        <Area type="monotone" dataKey="interest" name={interestLabel} stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.4} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
