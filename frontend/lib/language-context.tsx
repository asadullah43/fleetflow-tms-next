'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { authClient } from './grpc/auth';

export type Language = 'en' | 'ar';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);
const STORAGE_KEY = 'fleetflow_language';

function applyDocumentDirection(lang: Language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Global EN/AR language preference — restores the switcher the legacy
 * Flutter app had in its topbar dropdown and on its login screen (a
 * `SegmentedButton`). The choice is kept in localStorage so it applies
 * immediately, even before signing in, and — once there's a session — is
 * saved to the user's profile through the same `AuthService.UpdateLanguage`
 * RPC the legacy app called, so it travels with the account across
 * devices. Signing in then re-syncs the switcher from the profile's saved
 * language, same as the legacy screens did.
 *
 * Today this flips the document's text direction (RTL for Arabic) and
 * `lang` attribute app-wide; full string translation is a separate,
 * larger follow-on piece of work this hook is ready to support later
 * (every consumer already re-renders off `language`).
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');

  // Initial load: whatever was last chosen on this device/browser.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initial: Language = stored === 'ar' ? 'ar' : 'en';
    setLanguageState(initial);
    applyDocumentDirection(initial);
  }, []);

  // Once signed in, the account's saved preference takes over.
  useEffect(() => {
    if (user?.language === 'ar' || user?.language === 'en') {
      setLanguageState(user.language);
      applyDocumentDirection(user.language);
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, user.language);
    }
  }, [user]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      applyDocumentDirection(lang);
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, lang);
      if (token) {
        authClient.updateLanguage(token, lang).catch(() => {
          // Best-effort — the local switch has already taken effect.
        });
      }
    },
    [token],
  );

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
