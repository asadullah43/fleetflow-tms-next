'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import type { RpcError } from './grpc/client';

/**
 * Loads the dropdown/lookup data a page needs before it can render its
 * form (customers, trucks, ...). Replaces the useEffect + Promise.all +
 * setState block each page used to repeat, adding what those lacked:
 * - an error result instead of an endless "Loading..." when a call fails;
 * - ignoring a stale response when `deps` change mid-flight (e.g. the
 *   language is switched twice quickly and the slower load lands last).
 *
 * `load` receives the session token; it re-runs when the token or any of
 * `deps` change.
 */
export function useLookups<T>(load: (token: string) => Promise<T>, deps: readonly unknown[]): { data: T | null; error: string | null } {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    load(token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as RpcError).message || 'Failed to load data.');
      });
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure every render; `deps` is the caller's explicit list of what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ...deps]);

  return { data, error };
}
