import { startIdempotencyCleanup } from './idempotency-cleanup.js';
import { startOrphanFilesCleanup } from './orphan-files-cleanup.js';

/** Starts every background job. Returns a function that stops them (used on shutdown). */
export function startBackgroundServices(): () => void {
  const timers = [startIdempotencyCleanup(), startOrphanFilesCleanup()];
  return () => timers.forEach((timer) => clearInterval(timer));
}
