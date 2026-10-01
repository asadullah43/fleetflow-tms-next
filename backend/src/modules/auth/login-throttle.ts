/**
 * In-memory brute-force guard for Login: after MAX_FAILURES failed
 * attempts for the same username within WINDOW_MS, further attempts are
 * refused until the window passes. Keyed by username (the client IP isn't
 * reliably visible behind nginx + Envoy). Process-local — a restart
 * clears it, which is acceptable for a single-instance deployment.
 */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  firstFailureAt: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures = MAX_FAILURES,
    private readonly windowMs = WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  private key(username: string): string {
    return username.trim().toLowerCase();
  }

  private live(username: string): Entry | undefined {
    const entry = this.entries.get(this.key(username));
    if (entry && this.now() - entry.firstFailureAt > this.windowMs) {
      this.entries.delete(this.key(username));
      return undefined;
    }
    return entry;
  }

  isBlocked(username: string): boolean {
    return (this.live(username)?.failures ?? 0) >= this.maxFailures;
  }

  recordFailure(username: string): void {
    // Keep the map bounded when attempts arrive for many different usernames.
    if (this.entries.size > 10_000) {
      for (const [key, value] of this.entries) {
        if (this.now() - value.firstFailureAt > this.windowMs) this.entries.delete(key);
      }
    }
    const entry = this.live(username);
    if (entry) entry.failures += 1;
    else this.entries.set(this.key(username), { failures: 1, firstFailureAt: this.now() });
  }

  recordSuccess(username: string): void {
    this.entries.delete(this.key(username));
  }
}

export const loginThrottle = new LoginThrottle();
