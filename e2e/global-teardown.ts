import { rm } from "node:fs/promises";

/**
 * Remove the e2e production build (.next-e2e, see playwright.config.ts) after the run.
 * Build artifacts contain generated keys that the pre-push secret scan flags; there is
 * no reason to keep them around between runs.
 */
export default async function globalTeardown(): Promise<void> {
  await rm(".next-e2e", { recursive: true, force: true });
}
