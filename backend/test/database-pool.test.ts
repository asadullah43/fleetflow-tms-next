/**
 * The Prisma connection pool is set explicitly (config.database.pool), but
 * pool settings an operator already put in DATABASE_URL must win.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
const { withPoolSettings } = await import('../_core_app_connectivities/prisma.js');
const { config } = await import('../global_config/index.js');

const pool = { size: 10, timeoutSeconds: 10 };

test('adds connection_limit and pool_timeout, keeping the rest of the URL', () => {
  const url = new URL(withPoolSettings('postgresql://user:p%40ss@db:5432/fleetflow?schema=public', pool));
  assert.equal(url.searchParams.get('connection_limit'), '10');
  assert.equal(url.searchParams.get('pool_timeout'), '10');
  assert.equal(url.searchParams.get('schema'), 'public');
  assert.equal(url.username, 'user');
  assert.equal(url.password, 'p%40ss');
  assert.equal(`${url.hostname}:${url.port}${url.pathname}`, 'db:5432/fleetflow');
});

test('pool settings already in DATABASE_URL take precedence', () => {
  const url = new URL(withPoolSettings('postgresql://u@db/fleetflow?connection_limit=25&pool_timeout=3', pool));
  assert.equal(url.searchParams.get('connection_limit'), '25');
  assert.equal(url.searchParams.get('pool_timeout'), '3');
});

test('the default pool is the measured size (see global_config database.pool)', () => {
  if (process.env.DATABASE_POOL_SIZE || process.env.DATABASE_POOL_TIMEOUT_SECONDS) return;
  assert.deepEqual(config.database.pool, { size: 10, timeoutSeconds: 10 });
});
