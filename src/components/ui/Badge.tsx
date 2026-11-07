import type { ReactNode } from "react";

export type BadgeTone = "healthy" | "warning" | "danger" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  healthy: "text-status-healthy border-status-healthy/50",
  warning: "text-status-warning border-status-warning/50",
  danger: "text-status-danger border-status-danger/50",
  neutral: "text-on-surface-variant border-outline-variant",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  healthy: "bg-status-healthy",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
  neutral: "bg-outline",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-1.5 py-[1px] rounded-sm border text-[12px] leading-[18px] font-medium ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
