/**
 * "View the app as it was before a change": any page URL with `?before=<ISO timestamp>`
 * is rendered from a read-only copy of the database rebuilt from entity_history as it
 * stood just before that instant (see lib/db/asOfDatabase.ts). The middleware copies the
 * query param into a request header so getDb() can see it without every page threading it
 * through. Kept free of Node imports: the middleware runs on the edge runtime.
 */
export const BEFORE_PARAM = "before";
export const BEFORE_HEADER = "x-solvent-before";

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

/** The timestamp if `value` is a UTC ISO instant (as entity_history stores them), else undefined. */
export function parseBefore(value: string | null | undefined): string | undefined {
  return value && ISO_INSTANT.test(value) ? value : undefined;
}
