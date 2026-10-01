/** The signed-in session as kept in the browser between page loads. */
export interface StoredSession {
  token: string;
  /** ISO timestamp from the backend; the token is useless after it. */
  expiresAt: string;
}

const KEY = 'fleetflow_session';
const LEGACY_TOKEN_KEY = 'fleetflow_token';
const NOTICE_KEY = 'fleetflow_session_notice';

export function readStoredSession(): StoredSession | null {
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY); // sessions from before expiry tracking: sign in again
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null; // storage blocked or corrupted: treat as signed out
  }
}

export function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode / blocked): the session just won't survive a reload.
  }
}

/** Why the last session ended, kept across the redirect to the sign-in screen. */
export function writeSessionNotice(message: string | null): void {
  try {
    if (message) window.sessionStorage.setItem(NOTICE_KEY, message);
    else window.sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    // not essential
  }
}

export function readSessionNotice(): string | null {
  try {
    return window.sessionStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}
