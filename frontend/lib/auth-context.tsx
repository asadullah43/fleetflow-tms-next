'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { authClient, UserProfileDto } from './grpc/auth';

interface AuthState {
  token: string | null;
  user: UserProfileDto | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'fleetflow_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    authClient
      .getMe(stored)
      .then((profile) => {
        setToken(stored);
        setUser(profile);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { accessToken, user: profile } = await authClient.login(username, password);
    window.localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
