import type { ReactNode } from "react";

export type BadgeTone = "healthy" | "warning" | "danger" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  healthy: "text-status-healthy border-status-healthy bg-status-healthy/10",
  warning: "text-status-warning border-status-warning bg-status-warning/10",
  danger: "text-status-danger border-status-danger bg-status-danger/10",
  neutral: "text-on-surface-variant border-outline-variant bg-surface-container",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-label-md font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
