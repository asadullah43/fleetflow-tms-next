/**
 * Gated logging helper, modeled on the team's Node.js backend standard
 * (§6 "Logging Standards" — debug/info logs are gated behind a flag so
 * they can be silenced in production with one env var; errors are never
 * gated). Log lines use the mandated `file:line | function | message`
 * format so they can be correlated directly with error-monitoring
 * reports.
 *
 * Usage:
 *   const log = createLogger('trips.service.ts');
 *   log.debug('010', 'listTrips', `fetched ${rows.length} rows`);
 *   log.error('011', 'listTrips', 'query failed', err);
 */

const DEBUG_LOGS_ENABLED = process.env.DEBUG_LOGS_ENABLED === 'true';

export function createLogger(file: string) {
  return {
    /** Gated — silenced unless DEBUG_LOGS_ENABLED=true. Never log secrets/tokens/PII. */
    debug(lineId: string, fn: string, message: string, data?: unknown) {
      if (!DEBUG_LOGS_ENABLED) return;
      // eslint-disable-next-line no-console
      console.log(`${file}:${lineId} | ${fn} | ${message}`, data ?? '');
    },
    /** Never gated — always captured. */
    error(lineId: string, fn: string, message: string, err?: unknown) {
      // eslint-disable-next-line no-console
      console.error(`${file}:${lineId} | ${fn} | ${message}`, err ?? '');
    },
  };
}
