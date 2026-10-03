/**
 * Background job: deletes uploads that were never attached to a record
 * (an add/edit form opened, a file chosen, then cancelled). Started once
 * by app.ts.
 */
import { purgeOrphanFiles } from '../services/files.service.js';
import { logger } from '../utils/logger.js';

const INTERVAL_MS = 60 * 60 * 1000;

export function startOrphanFilesCleanup(): NodeJS.Timeout {
  const run = () =>
    purgeOrphanFiles()
      .then((count) => count > 0 && logger.info('orphan files cleanup', { deleted: count }))
      .catch((error) => logger.error('orphan files cleanup failed', { error }));
  void run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref(); // never keeps the process alive on its own
  return timer;
}
