/**
 * Background job: deletes idempotency records past their expiry so the
 * table doesn't grow forever. Started once by app.ts.
 */
import { prisma } from '../_core_app_connectivities/prisma.js';
import { runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { logger } from '../utils/logger.js';

const INTERVAL_MS = 60 * 60 * 1000;

export async function purgeExpiredIdempotencyRecords(): Promise<number> {
  // Housekeeping across all companies — the one job that is intentionally not tenant-scoped.
  const { count } = await runUnscoped(() => prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } }));
  return count;
}

export function startIdempotencyCleanup(): NodeJS.Timeout {
  const run = () =>
    purgeExpiredIdempotencyRecords()
      .then((count) => count > 0 && logger.info('idempotency cleanup', { deleted: count }))
      .catch((error) => logger.error('idempotency cleanup failed', { error }));
  void run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref(); // never keeps the process alive on its own
  return timer;
}
