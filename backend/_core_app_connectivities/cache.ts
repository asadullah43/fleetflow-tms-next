/**
 * PROTECTED CORE CONNECTIVITY — the read cache in front of PostgreSQL.
 *
 * TENANT ISOLATION. Every key that holds data or a version embeds the
 * company id (`fleetflow:company:<id>:…`), taken from the request's tenant
 * context and never from caller input; nothing is cached outside a tenant
 * context. The one key without a company is `fleetflow:epoch`, a random
 * token holding no data, used to invalidate everything at once.
 *
 * HOW ENTRIES STAY CORRECT. Each table has, per company, a version token
 * that every write replaces (prisma.ts calls `invalidateAfterWrite` for
 * every write any code makes — repository, custom service, nested write).
 * When a read is cached, the cache records which tables it actually read
 * (seen by prisma.ts through `beforeRead`, relations included) and the
 * versions they had *before* each query ran. A later lookup is served
 * only if all those versions — and the epoch — are unchanged. So a save
 * is visible on the very next read, with no TTL involved, and a page
 * showing customer names is invalidated when a customer is renamed.
 *
 * WHAT IS NEVER CACHED. Only code wrapped in `cachedRead` is cached, and
 * a wrapped computation that writes anything is not stored. Sequence
 * numbers (INV-, WO-, EMP-, LDO-, TRP-) and ZATCA submission are writes, so
 * they always read the database.
 *
 * FAILURE. Redis down or slow: the read goes to the database. A write
 * whose invalidation could not be delivered switches the cache off in
 * this process until the epoch is replaced on reconnection, so nothing
 * cached before the outage can be served afterwards.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from '../utils/logger.js';
import { modelsTouched } from './model-relations.js';
import { CacheStore, getCacheStore } from './redis.js';
import { getTenantContext } from './tenant-context.js';

const PREFIX = 'fleetflow';

/** Tables whose rows are never part of a cached result, so writing them needs no invalidation. */
const NEVER_CACHED = new Set(['IdempotencyRecord']);

function assertCompany(companyId: number): number {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error(`cache: invalid company id ${String(companyId)}`);
  return companyId;
}

/** Every key the cache uses. Data and version keys cannot be built without a company. */
export const cacheKeys = {
  data: (companyId: number, scope: string, argsHash: string) => `${PREFIX}:company:${assertCompany(companyId)}:data:${scope}:${argsHash}`,
  version: (companyId: number, model: string) => `${PREFIX}:company:${assertCompany(companyId)}:version:${model}`,
  epoch: () => `${PREFIX}:epoch`,
};

/** A fresh, never-repeating version value. */
const token = () => `${Date.now().toString(36)}.${crypto.randomBytes(6).toString('hex')}`;

// ── Codec: cached values come back with exactly their original types ──────
// Rows hold Date and Decimal objects; plain JSON would turn them into strings.

const TAG = '\u0000ff';

class Uncacheable extends Error {}

function encode(value: unknown): unknown {
  if (value === undefined) return { [TAG]: 'u' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Uncacheable('non-finite number');
    return value;
  }
  if (value instanceof Date) return { [TAG]: 'd', v: value.toISOString() };
  if (Prisma.Decimal.isDecimal(value)) return { [TAG]: 'n', v: (value as Prisma.Decimal).toString() };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Uncacheable(`unsupported ${proto?.constructor?.name ?? 'object'}`);
    if (TAG in value) throw new Uncacheable('reserved key');
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = encode(item);
    return out;
  }
  throw new Uncacheable(typeof value);
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  switch (record[TAG]) {
    case 'u':
      return undefined;
    case 'd':
      return new Date(record.v as string);
    case 'n':
      return new Prisma.Decimal(record.v as string);
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) out[key] = decode(item);
  return out;
}

/** Stable JSON: object keys sorted, so equal arguments always hash the same. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const cacheCodec = { encode, decode, hash: (args: unknown) => crypto.createHash('sha256').update(stable(encode(args))).digest('hex').slice(0, 32) };

// ── Store availability ────────────────────────────────────────────────────

/** True after a write's invalidation could not be delivered: nothing may be served until the epoch is replaced. */
let suspended = false;
/** True only while recovering from a real outage (not the initial start-up pause), for logging. */
let outage = false;
let lastRecoveryAttempt = 0;
const listening = new WeakSet<CacheStore>();
let pendingReset: Promise<void> = Promise.resolve();

export const cacheStats = { hits: 0, misses: 0, bypassed: 0, invalidations: 0, failures: 0 };

/**
 * Replaces the epoch, invalidating every entry of every company. Done
 * whenever a connection is (re)established — on start-up, so entries
 * written by a previous version of the code (whose rows may have had
 * another shape) are never served, and after an outage, during which
 * invalidations may have been lost.
 */
async function resetEpoch(store: CacheStore): Promise<void> {
  try {
    await store.set(cacheKeys.epoch(), token());
    if (outage) logger.info('cache: resumed (all entries invalidated after the outage)');
    suspended = false;
    outage = false;
  } catch {
    suspended = true;
  }
}

/** The store, if caching may be used right now; otherwise null (read the database). */
function usableStore(): CacheStore | null {
  const store = getCacheStore();
  if (!store) return null;
  if (!listening.has(store)) {
    listening.add(store);
    // Until the first epoch reset, entries from before this process started must not be trusted.
    suspended = true;
    store.onReady(() => {
      pendingReset = resetEpoch(store);
    });
  }
  if (suspended) {
    const now = Date.now();
    if (now - lastRecoveryAttempt > 1000) {
      lastRecoveryAttempt = now;
      pendingReset = resetEpoch(store);
    }
    return null;
  }
  return store;
}

/** Connects (if configured) and resolves once the cache may serve entries — or has given up for now. For start-up and tests. */
export async function warmUpCache(waitMs = 2000): Promise<boolean> {
  usableStore();
  const deadline = Date.now() + waitMs;
  for (;;) {
    await pendingReset;
    if (!suspended || getCacheStore() === null || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !suspended && getCacheStore() !== null;
}

function suspend(error: unknown): void {
  cacheStats.failures++;
  outage = true;
  if (!suspended) logger.warn('cache: could not deliver an invalidation; caching paused until Redis is reachable', { error: error instanceof Error ? error.message : String(error) });
  suspended = true;
}

/** The current version of each model for a company, creating a version for any model that has none yet. */
async function currentVersions(store: CacheStore, companyId: number, models: string[]): Promise<string[]> {
  const keys = models.map((model) => cacheKeys.version(companyId, model));
  const values = await store.mget(keys);
  const missing = keys.filter((_, index) => values[index] === null);
  if (missing.length === 0) return values as string[];
  await Promise.all(missing.map((key) => store.setIfAbsent(key, token())));
  return (await store.mget(keys)) as string[];
}

// ── Reads ─────────────────────────────────────────────────────────────────

interface Recording {
  companyId: number;
  /** model -> its version, read before the first query on it ran. */
  versions: Map<string, Promise<string | null>>;
  uncacheable: boolean;
}

const recording = new AsyncLocalStorage<Recording>();

interface Entry {
  epoch: string;
  versions: Record<string, string>;
  data: unknown;
}

/**
 * Called by prisma.ts before every read query. While a `cachedRead` is
 * computing, notes each table the query reads and — before the query is
 * allowed to run — that table's version. (Taking the version first is
 * what makes a concurrent write always detectable.)
 */
export async function beforeRead(model: string, args: unknown): Promise<void> {
  const rec = recording.getStore();
  if (!rec || rec.uncacheable) return;
  const ctx = getTenantContext();
  if (!ctx || ctx.unscoped || ctx.companyId !== rec.companyId || NEVER_CACHED.has(model)) {
    rec.uncacheable = true;
    return;
  }
  const store = getCacheStore();
  if (!store) {
    rec.uncacheable = true;
    return;
  }
  const pending: Promise<string | null>[] = [];
  for (const touched of modelsTouched(model, args)) {
    let version = rec.versions.get(touched);
    if (!version) {
      version = currentVersions(store, rec.companyId, [touched]).then(
        ([value]) => value,
        () => null,
      );
      rec.versions.set(touched, version);
    }
    pending.push(version);
  }
  if ((await Promise.all(pending)).some((version) => version === null)) rec.uncacheable = true;
}

/**
 * Runs `compute` (a read) through the cache for the current company.
 * `scope` names the read (e.g. "Truck.list"); `args` is everything else
 * its result depends on (query, filters, day…). Falls through to
 * `compute` whenever caching is unavailable or not allowed.
 */
export async function cachedRead<T>(scope: string, args: unknown, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const ctx = getTenantContext();
  // Outside a tenant, or inside another cached read (whose recording covers this one): just read.
  if (!ctx || ctx.unscoped || ctx.companyId === null || recording.getStore()) return compute();
  const store = usableStore();
  if (!store) {
    cacheStats.bypassed++;
    return compute();
  }
  const companyId = ctx.companyId;

  let key: string;
  try {
    key = cacheKeys.data(companyId, scope, cacheCodec.hash(args));
  } catch {
    return compute();
  }

  let epoch: string | null;
  try {
    // The entry and the epoch in one round trip: a miss needs nothing more before computing.
    const [raw, epochNow] = await store.mget([key, cacheKeys.epoch()]);
    epoch = epochNow;
    if (raw) {
      const entry = JSON.parse(raw) as Entry;
      const models = Object.keys(entry.versions);
      // The epoch is read again together with the versions, so a hit is judged on one consistent snapshot.
      const [currentEpoch, ...versions] = await store.mget([cacheKeys.epoch(), ...models.map((model) => cacheKeys.version(companyId, model))]);
      if (currentEpoch === entry.epoch && models.every((model, index) => versions[index] === entry.versions[model])) {
        cacheStats.hits++;
        return decode(entry.data) as T;
      }
      epoch = currentEpoch;
    }
  } catch {
    cacheStats.bypassed++;
    return compute();
  }

  cacheStats.misses++;
  const rec: Recording = { companyId, versions: new Map(), uncacheable: epoch === null };
  const result = await recording.run(rec, compute);
  if (!rec.uncacheable && epoch !== null && rec.versions.size > 0 && !suspended) {
    try {
      const versions: Record<string, string> = {};
      for (const [model, version] of rec.versions) {
        const value = await version;
        if (value === null) throw new Uncacheable('version unavailable');
        versions[model] = value;
      }
      // Encoded now (a snapshot of the result as returned); the SET is sent now but not waited for —
      // the caller needs the rows, not Redis's acknowledgement. A failed SET just means a later miss.
      store.set(key, JSON.stringify({ epoch, versions, data: encode(result) } satisfies Entry), ttlSeconds).catch(() => undefined);
    } catch {
      // Not storable (unsupported value): the caller still gets the database's answer.
    }
  }
  return result;
}

// ── Writes ────────────────────────────────────────────────────────────────

/** company id (or '*' for "every company") -> models written during the current request. */
const requestWrites = new AsyncLocalStorage<Map<number | '*', Set<string>>>();

async function bump(store: CacheStore, companyId: number | '*', models: Iterable<string>): Promise<void> {
  const entries: [string, string][] = companyId === '*' ? [[cacheKeys.epoch(), token()]] : [...models].map((model) => [cacheKeys.version(companyId, model), token()]);
  await store.setMany(entries);
  cacheStats.invalidations += entries.length;
}

/** Companies a write without a tenant context touched, read from the rows it returned; '*' when unknowable. */
function companiesOf(result: unknown): (number | '*')[] {
  const rows = Array.isArray(result) ? result : [result];
  const ids = rows.map((row) => (row && typeof row === 'object' ? (row as { companyId?: unknown }).companyId : undefined));
  return ids.length > 0 && ids.every((id): id is number => typeof id === 'number') ? [...new Set(ids)] : ['*'];
}

/**
 * Called by prisma.ts after every successful write, before the write's
 * result is returned. Replaces the version of the written table (and of
 * every table reached by a nested write) for the company, so the next
 * read of anything built on them misses. Also remembered for the request,
 * to be repeated once the request has finished (see `trackRequestWrites`).
 */
export async function invalidateAfterWrite(model: string, args: unknown, result: unknown): Promise<void> {
  const rec = recording.getStore();
  if (rec) rec.uncacheable = true; // a computation that writes is never cached
  if (NEVER_CACHED.has(model)) return;
  const store = getCacheStore();
  if (!store) return;

  const models = modelsTouched(model, args);
  const ctx = getTenantContext();
  const companies = ctx && !ctx.unscoped && ctx.companyId !== null ? [ctx.companyId] : companiesOf(result);

  const writes = requestWrites.getStore();
  for (const companyId of companies) {
    if (!writes) continue;
    const set = writes.get(companyId) ?? new Set<string>();
    for (const touched of models) set.add(touched);
    writes.set(companyId, set);
  }

  try {
    for (const companyId of companies) await bump(store, companyId, models);
  } catch (error) {
    suspend(error);
  }
}

/**
 * Runs one request, then invalidates again everything it wrote. The
 * invalidation inside the write already happened, but a write inside a
 * transaction is invalidated before it commits; a read in that gap could
 * cache the old rows under the new version. Repeating it after the
 * request (so after the commit, before the response is sent) closes that.
 */
export async function trackRequestWrites<T>(run: () => Promise<T>): Promise<T> {
  const writes = new Map<number | '*', Set<string>>();
  try {
    return await requestWrites.run(writes, run);
  } finally {
    const store = writes.size > 0 ? getCacheStore() : null;
    if (store) {
      try {
        for (const [companyId, models] of writes) await bump(store, companyId, models);
      } catch (error) {
        suspend(error);
      }
    }
  }
}

/** Test hook: forget availability state (as on a process start). */
export function resetCacheStateForTests(): void {
  suspended = false;
  outage = false;
  lastRecoveryAttempt = 0;
  for (const key of Object.keys(cacheStats) as (keyof typeof cacheStats)[]) cacheStats[key] = 0;
}
