/**
 * PROTECTED CORE CONNECTIVITY — the single Redis connection for the whole
 * process, used only by the read cache (cache.ts). Redis is optional:
 * with REDIS_URL unset there is no store and nothing is cached; with it
 * set but unreachable, every command fails fast (no offline queue, a
 * short timeout) and the cache falls through to the database.
 */
import { Redis } from 'ioredis';
import { config } from '../global_config/index.js';
import { logger } from '../utils/logger.js';

/** The handful of operations the cache needs. Every method rejects when the store cannot answer in time. */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  /** With `ttlSeconds` the key expires; without, it is kept (versions must never silently vanish). */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** SET NX: only when the key does not exist yet. */
  setIfAbsent(key: string, value: string): Promise<void>;
  /** Several keys at once, no expiry. */
  setMany(entries: [string, string][]): Promise<void>;
  /** Called when a (re)connection is established, so the cache can recover from writes it could not invalidate. */
  onReady(listener: () => void): void;
}

export class StoreUnavailableError extends Error {
  constructor(reason: string) {
    super(`cache store unavailable: ${reason}`);
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StoreUnavailableError(`no answer within ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new StoreUnavailableError(String(error)));
      },
    );
  });
}

export class RedisStore implements CacheStore {
  private readonly client: Redis;
  private readonly listeners: (() => void)[] = [];
  private reported = false;

  constructor(url: string, private readonly timeoutMs: number) {
    this.client = new Redis(url, {
      // Never queue commands while disconnected: a request must fall through to the database at once.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 2000,
      // Keep trying to reconnect in the background, backing off to every 5 s.
      retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
    });
    this.client.on('ready', () => {
      if (this.reported) logger.info('cache: Redis reachable again');
      this.reported = false;
      for (const listener of this.listeners) listener();
    });
    this.client.on('error', (error: Error) => {
      // Once per outage, not once per reconnect attempt.
      if (!this.reported) logger.warn('cache: Redis unavailable, reading from the database', { error: error.message });
      this.reported = true;
    });
  }

  private run<T>(work: () => Promise<T>): Promise<T> {
    if (this.client.status !== 'ready') return Promise.reject(new StoreUnavailableError(this.client.status));
    return withTimeout(work(), this.timeoutMs);
  }

  get(key: string) {
    return this.run(() => this.client.get(key));
  }

  mget(keys: string[]) {
    return this.run(() => this.client.mget(keys));
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    await this.run(() => (ttlSeconds ? this.client.set(key, value, 'EX', ttlSeconds) : this.client.set(key, value)));
  }

  async setIfAbsent(key: string, value: string) {
    await this.run(() => this.client.set(key, value, 'NX'));
  }

  async setMany(entries: [string, string][]) {
    if (entries.length === 0) return;
    await this.run(() => this.client.mset(entries.flat()));
  }

  onReady(listener: () => void) {
    this.listeners.push(listener);
    if (this.client.status === 'ready') listener();
  }

  /** Closes the connection and stops reconnecting (QUIT when connected; otherwise drop it — QUIT would wait for a server that is not there). */
  async quit() {
    if (this.client.status === 'ready') await this.client.quit().catch(() => this.client.disconnect());
    else this.client.disconnect();
  }
}

/** In-process store with the same semantics, for tests (and for reasoning about the cache without a server). */
export class MemoryStore implements CacheStore {
  readonly data = new Map<string, { value: string; expiresAt: number | null }>();
  /** Simulates an outage: every command rejects as a real unreachable Redis would. */
  down = false;
  private readonly listeners: (() => void)[] = [];

  private check() {
    if (this.down) throw new StoreUnavailableError('simulated outage');
  }

  private read(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    this.check();
    return this.read(key);
  }

  async mget(keys: string[]) {
    this.check();
    return keys.map((key) => this.read(key));
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.check();
    this.data.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async setIfAbsent(key: string, value: string) {
    this.check();
    if (this.read(key) === null) this.data.set(key, { value, expiresAt: null });
  }

  async setMany(entries: [string, string][]) {
    this.check();
    for (const [key, value] of entries) this.data.set(key, { value, expiresAt: null });
  }

  onReady(listener: () => void) {
    this.listeners.push(listener);
    if (!this.down) listener(); // like an already-connected Redis
  }

  /** Ends a simulated outage and fires the reconnection listeners, like ioredis's 'ready'. */
  recover() {
    this.down = false;
    for (const listener of this.listeners) listener();
  }
}

let store: CacheStore | null | undefined;

/** The process's cache store, created on first use; null when caching is switched off (no REDIS_URL). */
export function getCacheStore(): CacheStore | null {
  if (store === undefined) store = config.cache.url ? new RedisStore(config.cache.url, config.cache.commandTimeoutMs) : null;
  return store;
}

/** Replaces the store (tests). Pass null to switch caching off. */
export function setCacheStore(next: CacheStore | null): void {
  store = next;
}

export async function disconnectCache(): Promise<void> {
  if (store instanceof RedisStore) await store.quit();
  store = undefined;
}
