"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lets ArrowLeft/ArrowRight page the timeline by a month, mirroring the prev/next
 * buttons — skipped while focus is in a form control so typing isn't hijacked. */
export function MonthKeyboardNav({
  previousHref,
  nextHref,
  atStart,
  atEnd,
}: {
  previousHref: string;
  nextHref: string;
  atStart: boolean;
  atEnd: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (event.key === "ArrowLeft" && !atStart) {
        router.push(previousHref);
      } else if (event.key === "ArrowRight" && !atEnd) {
        router.push(nextHref);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previousHref, nextHref, atStart, atEnd, router]);

  return null;
}
