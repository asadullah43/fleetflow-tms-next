/**
 * In-memory fixed-window rate limiter. Process-local: counts reset on
 * restart and are not shared between instances — fine for the current
 * single-instance deployment; swap the Map for Redis here (and only
 * here) if the backend is ever scaled out.
 */
export interface RateLimitRule {
  points: number;
  windowSeconds: number;
  blockSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  retryAfterSeconds: number;
}

interface Entry {
  used: number;
  windowStart: number;
  blockedUntil: number;
}

const MAX_ENTRIES = 50_000;

export class RateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = Date.now,
  ) {}

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = this.now();
    if (entry.blockedUntil > now) return entry;
    if (now - entry.windowStart >= this.rule.windowSeconds * 1000) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private result(entry: Entry | undefined): RateLimitResult {
    const now = this.now();
    if (entry && entry.blockedUntil > now) {
      return { allowed: false, remainingPoints: 0, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
    }
    return { allowed: true, remainingPoints: Math.max(0, this.rule.points - (entry?.used ?? 0)), retryAfterSeconds: 0 };
  }

  /** Current state without spending a point. */
  peek(key: string): RateLimitResult {
    return this.result(this.live(key));
  }

  /** Spends one point; once the limit is exceeded the key is blocked for `blockSeconds`. */
  consume(key: string): RateLimitResult {
    const now = this.now();
    let entry = this.live(key);
    if (entry && entry.blockedUntil > now) return this.result(entry);
    if (!entry) {
      if (this.entries.size >= MAX_ENTRIES) this.prune();
      entry = { used: 0, windowStart: now, blockedUntil: 0 };
      this.entries.set(key, entry);
    }
    entry.used += 1;
    if (entry.used > this.rule.points) entry.blockedUntil = now + this.rule.blockSeconds * 1000;
    return this.result(entry);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(): void {
    for (const key of this.entries.keys()) if (!this.live(key)) this.entries.delete(key);
  }
}
