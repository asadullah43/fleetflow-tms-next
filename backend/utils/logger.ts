/**
 * Structured (one JSON object per line) logging. `debug` is silenced
 * unless DEBUG_LOGS_ENABLED=true; `info`/`warn`/`error` always log.
 *
 * Never pass secrets here: passwords, JWTs, API keys, private keys,
 * connection strings. Request bodies are not logged at all.
 */
import { config } from '../global_config/index.js';

type Fields = Record<string, unknown>;

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    const withCode = err as Error & { code?: unknown };
    return { name: err.name, message: err.message, code: withCode.code, stack: err.stack };
  }
  return err;
}

function write(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields: Fields = {}): void {
  const { error, ...rest } = fields;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...rest,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, fields?: Fields): void {
    if (config.logging.debug) write('debug', message, fields);
  },
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
};
