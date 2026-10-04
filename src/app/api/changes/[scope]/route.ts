import { onChange } from "../../../../lib/services/changeEvents.js";

// This is an infinite SSE stream, not a cacheable response — without this, Next.js's
// static-route analysis (which doesn't see any dynamic API used below, since the
// stream's contents aren't known until a change happens) can try to buffer/collect
// the whole response before sending anything, which never completes.
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a change "scope" (e.g. "loans", "upload"). Emits one
 * `data: change` message each time something calls `emitChange(scope)` server-side —
 * pages subscribe via LiveRefresh instead of polling on a timer, and re-fetch their
 * server data only when something actually changed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ scope: string }> }): Promise<Response> {
  const { scope } = await params;
  const encoder = new TextEncoder();

  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = onChange(scope, () => {
        controller.enqueue(encoder.encode("data: change\n\n"));
      });
      // Comment-only keepalive frame so intermediary proxies/browsers don't time out
      // an otherwise-idle connection; ignored by EventSource's onmessage.
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
