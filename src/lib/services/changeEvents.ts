import "server-only";
import { EventEmitter } from "node:events";

/**
 * Process-wide pub/sub so server actions and background work (e.g. contract
 * extraction, which updates its document row from a fire-and-forget async task with
 * no server action of its own) can notify open pages that their data changed —
 * without those pages having to poll on a timer. One process-lifetime EventEmitter is
 * enough here: this app is local-first and single-process (no multi-instance/serverless
 * fan-out to coordinate across).
 */
const emitter = new EventEmitter();
// Each open browser tab holds one SSE subscription per scope; raise the default cap
// (10) so a few tabs/scopes don't trigger Node's MaxListenersExceededWarning.
emitter.setMaxListeners(50);

/** Notifies every current subscriber of `scope` that its data changed. Fire-and-forget. */
export function emitChange(scope: string): void {
  emitter.emit(scope);
}

/** Subscribes to `scope`; call the returned function to unsubscribe. */
export function onChange(scope: string, listener: () => void): () => void {
  emitter.on(scope, listener);
  return () => emitter.off(scope, listener);
}
