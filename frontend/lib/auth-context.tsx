'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { authClient, UserProfileDto } from './grpc/auth';
import { setSessionExpiredHandler, isUnauthenticated } from './grpc/client';
import { hasPermission, moduleForPath, PermissionAction, PermissionRow } from './permissions';

interface AuthState {
  token: string | null;
  user: UserProfileDto | null;
  /** The caller's effective permission matrix (null until loaded). */
  permissions: PermissionRow[] | null;
  loading: boolean;
  /** Why the last session ended, when it wasn't the user signing out (shown on the login screen). */
  sessionNotice: string | null;
  /** Signs in and returns the new session's permission matrix (for choosing where to land). */
  login: (username: string, password: string) => Promise<PermissionRow[]>;
  logout: () => void;
  can: (module: string, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'fleetflow_token';

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode / blocked): the session just won't survive a reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfileDto | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    writeStoredToken(null);
    setToken(null);
    setUser(null);
    setPermissions(null);
  }, []);

  // Restore a saved session on load.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no saved session: finish the post-hydration check
      setLoading(false);
      return;
    }
    Promise.all([authClient.getMe(stored), authClient.getMyPermissions(stored)])
      .then(([profile, perms]) => {
        setToken(stored);
        setUser(profile);
        setPermissions(perms);
      })
      .catch((err) => {
        // Only a rejected token ends the session — a network blip or the
        // backend restarting must not silently sign the user out.
        if (isUnauthenticated(err)) writeStoredToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Any RPC rejected as UNAUTHENTICATED mid-session (expired token,
  // account deactivated) signs the user out; AppShell then redirects.
  useEffect(() => {
    setSessionExpiredHandler((message) => {
      setSessionNotice(message);
      clearSession();
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const { accessToken, user: profile } = await authClient.login(username, password);
    const perms = await authClient.getMyPermissions(accessToken);
    writeStoredToken(accessToken);
    setSessionNotice(null);
    setToken(accessToken);
    setUser(profile);
    setPermissions(perms);
    return perms;
  }, []);

  const logout = useCallback(() => {
    setSessionNotice(null);
    clearSession();
  }, [clearSession]);

  const can = useCallback((module: string, action: PermissionAction) => hasPermission(permissions, module, action), [permissions]);

  return (
    <AuthContext.Provider value={{ token, user, permissions, loading, sessionNotice, login, logout, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * What the signed-in user may do on the current page, derived from its
 * URL. Pages that aren't mapped to a module allow everything here (the
 * backend still enforces its own checks).
 */
export function usePagePermissions(): Record<PermissionAction, boolean> {
  const { can } = useAuth();
  const pathname = usePathname();
  const pageModule = moduleForPath(pathname);
  if (!pageModule) return { view: true, add: true, edit: true, delete: true };
  return { view: can(pageModule, 'view'), add: can(pageModule, 'add'), edit: can(pageModule, 'edit'), delete: can(pageModule, 'delete') };
}
