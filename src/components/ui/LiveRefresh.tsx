"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribes to server-side changes for `scope` via SSE (see
 * /api/changes/[scope]/route.ts + lib/services/changeEvents.ts) and refreshes this
 * page's server data only when something actually changed — no polling on a timer.
 * If a change arrives while the tab is hidden, the refresh is deferred until the tab
 * becomes visible again rather than dropped.
 */
export function LiveRefresh({ scope }: { scope: string }) {
  const router = useRouter();
  const pendingRef = useRef(false);

  useEffect(() => {
    const refreshNow = () => {
      pendingRef.current = false;
      router.refresh();
    };

    const source = new EventSource(`/api/changes/${scope}`);
    source.onmessage = () => {
      if (document.visibilityState === "visible") {
        refreshNow();
      } else {
        pendingRef.current = true;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingRef.current) {
        refreshNow();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [scope, router]);

  return null;
}
