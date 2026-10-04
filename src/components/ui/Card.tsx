import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-stack-md">{children}</div>
  );
}
