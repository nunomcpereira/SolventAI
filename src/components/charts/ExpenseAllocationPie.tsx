"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_PROPS } from "./chartTheme.js";

export interface AllocationSlice {
  key: string;
  label: string;
  /** Monthly amount, as a plain number for the chart geometry only. */
  value: number;
  formattedValue: string;
  formattedShare: string;
  color: string;
}

/**
 * Pie of the average month's recurring expenses by category. Purely presentational:
 * amounts and shares come pre-computed (engine/metrics/expenseAllocation). Slices are
 * separated by a 2px surface-colored gap; the list beside the chart carries names and
 * figures, so identity never rests on color alone.
 */
export function ExpenseAllocationPie({ slices, ariaLabel }: { slices: AllocationSlice[]; ariaLabel: string }) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius="92%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--color-surface-container-lowest)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            {...TOOLTIP_PROPS}
            cursor={false}
            itemStyle={{ color: "var(--chart-tooltip-label)" }}
            separator=": "
            formatter={(_value, _name, item) => {
              const slice = item.payload as AllocationSlice;
              return [`${slice.formattedValue} · ${slice.formattedShare}`, slice.label];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
