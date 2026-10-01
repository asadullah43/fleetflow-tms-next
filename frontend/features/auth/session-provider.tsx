'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, UserProfileDto } from '../../lib/api/auth.api';
import { setApiEventHandlers, setAuthToken } from '../../lib/api/client';
import { ApiError, isApiError } from '../../lib/api/errors';
import { queryKeys } from '../../lib/api/query-keys';
import { msUntil } from '../../lib/date';
import { translate } from '../../lib/i18n/dictionary';
import { hasPermission, moduleForPath, PermissionAction, PermissionRow } from '../../lib/permissions';
import { readSessionNotice, readStoredSession, StoredSession, writeSessionNotice, writeStoredSession } from './session-storage';

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

interface SessionData {
  user: UserProfileDto;
  permissions: PermissionRow[];
}

interface SessionState {
  user: UserProfileDto | null;
  /** The caller's effective permission matrix (null until loaded). */
  permissions: PermissionRow[] | null;
  /** True until it is known whether there is a valid session. */
  loading: boolean;
  /** Set when a stored session could not be checked because the server was unreachable. */
  connectionError: string | null;
  retry: () => void;
  /** Why the last session ended, when it wasn't the user signing out (shown on the sign-in screen). */
  sessionNotice: string | null;
  /** Signs in and returns the new session's permission matrix (for choosing where to land). */
  login: (username: string, password: string, language?: string) => Promise<PermissionRow[]>;
  logout: () => void;
  can: (module: string, action: PermissionAction) => boolean;
}

const SessionContext = createContext<SessionState | null>(null);

function currentLanguage(): 'en' | 'ar' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}

/**
 * Owns the signed-in session for the whole app:
 * - keeps the API client's token in step with it;
 * - ends it — clearing every cached query — when the user signs out,
 *   when the backend rejects the token, or when its 12 hours are up;
 * - shows the one app-wide "too many requests" notice.
 * The backend remains the authority on expiry; the timer here only makes
 * the sign-out happen on time instead of on the next click.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // undefined = browser storage not read yet (first render must match the server's)
  const [stored, setStored] = useState<StoredSession | null | undefined>(undefined);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const endSession = useCallback(
    (notice: string | null) => {
      setAuthToken(null);
      writeStoredSession(null);
      writeSessionNotice(notice);
      setSessionNotice(notice);
      setStored(null);
      // Nothing fetched for the previous user may be shown to the next one.
      queryClient.clear();
    },
    [queryClient],
  );

  useEffect(() => {
    const saved = readStoredSession();
    const usable = saved && msUntil(saved.expiresAt) > 0 ? saved : null;
    if (saved && !usable) writeStoredSession(null);
    setAuthToken(usable?.token ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage after hydration
    setStored(usable);
    setSessionNotice(usable ? null : saved ? SESSION_EXPIRED_MESSAGE : readSessionNotice());
  }, []);

  useEffect(() => {
    setApiEventHandlers({
      onUnauthenticated: (error: ApiError) => endSession(error.message || SESSION_EXPIRED_MESSAGE),
      onRateLimited: (error: ApiError) =>
        notifications.show({ id: 'rate-limit', color: 'orange', title: translate('Too many requests', currentLanguage()), message: error.message, autoClose: 8000 }),
    });
    return () => setApiEventHandlers({});
  }, [endSession]);

  // Sign out at the moment the session expires, not on the first click after it.
  useEffect(() => {
    if (!stored) return;
    const timer = window.setTimeout(() => endSession(SESSION_EXPIRED_MESSAGE), Math.max(0, Math.min(msUntil(stored.expiresAt), 2_000_000_000)));
    return () => window.clearTimeout(timer);
  }, [stored, endSession]);

  const token = stored?.token ?? null;
  const session = useQuery<SessionData>({
    queryKey: queryKeys.session(),
    queryFn: async () => {
      const [user, permissions] = await Promise.all([authApi.getMe(), authApi.getMyPermissions()]);
      return { user, permissions };
    },
    enabled: !!token,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const login = useCallback(
    async (username: string, password: string, language?: string) => {
      const { accessToken, expiresAt, user } = await authApi.login(username, password, language);
      const permissions = await authApi.getMyPermissions(accessToken);
      queryClient.clear();
      queryClient.setQueryData<SessionData>(queryKeys.session(), { user, permissions });
      setAuthToken(accessToken);
      writeStoredSession({ token: accessToken, expiresAt });
      writeSessionNotice(null);
      setSessionNotice(null);
      setStored({ token: accessToken, expiresAt });
      return permissions;
    },
    [queryClient],
  );

  const logout = useCallback(() => endSession(null), [endSession]);

  const data = token ? session.data : undefined;
  const permissions = data?.permissions ?? null;
  const can = useCallback((module: string, action: PermissionAction) => hasPermission(permissions, module, action), [permissions]);

  const value = useMemo<SessionState>(
    () => ({
      user: data?.user ?? null,
      permissions,
      loading: stored === undefined || (!!token && session.isPending),
      connectionError: token && session.isError && isApiError(session.error) && session.error.transport ? session.error.message : null,
      retry: () => void session.refetch(),
      sessionNotice,
      login,
      logout,
      can,
    }),
    [data, permissions, stored, token, session, sessionNotice, login, logout, can],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAuth(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useAuth must be used within SessionProvider');
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
  return useMemo(() => {
    if (!pageModule) return { view: true, add: true, edit: true, delete: true };
    return { view: can(pageModule, 'view'), add: can(pageModule, 'add'), edit: can(pageModule, 'edit'), delete: can(pageModule, 'delete') };
  }, [can, pageModule]);
}
