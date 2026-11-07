import type { ReactNode } from "react";
import { Card, CardLabel } from "./Card.js";

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4">
      <CardLabel>{label}</CardLabel>
      <div className="figure text-[22px] leading-7 text-on-surface">{value}</div>
      {hint !== undefined ? <div className="text-label-sm text-on-surface-variant mt-1">{hint}</div> : null}
    </Card>
  );
}
