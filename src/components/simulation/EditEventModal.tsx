"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps the event-edit form in a centered popup instead of leaving it inline at the
 * bottom of the (potentially long) events list, where the user had to notice a new
 * section appeared and scroll down to it. `cancelHref` drives both the backdrop-click
 * and Escape-key dismissal — it's the same URL the form's own Cancel link already
 * navigates to (dropping `editEventId`), so closing the popup any of these ways is
 * equivalent to clicking Cancel.
 */
export function EditEventModal({ cancelHref, children }: { cancelHref: string; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(cancelHref);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelHref, router]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => router.push(cancelHref)}>
      <div
        className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant rounded-sm p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
