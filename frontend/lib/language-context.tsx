'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { authClient } from './grpc/auth';
import { translate, localizeDigits, localizeStatValue } from './i18n/dictionary';

export type Language = 'en' | 'ar';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);
const STORAGE_KEY = 'fleetflow_language';

function readStoredLanguage(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en'; // storage blocked (private mode, policy): default language
  }
}

function writeStoredLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage blocked: the choice still applies for this session
  }
}

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
 * Flips the document's text direction (RTL for Arabic) and `lang`
 * attribute app-wide; `useT()` below translates UI strings through
 * lib/i18n/dictionary.ts.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');

  // Initial load: whatever was last chosen on this device/browser. Read in
  // an effect (not the useState initializer) so the server render and the
  // first client render agree, avoiding a hydration mismatch.
  useEffect(() => {
    const initial: Language = readStoredLanguage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
    setLanguageState(initial);
    applyDocumentDirection(initial);
  }, []);

  // Once signed in, the account's saved preference takes over.
  useEffect(() => {
    if (user?.language === 'ar' || user?.language === 'en') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting the profile's language when a session starts
      setLanguageState(user.language);
      applyDocumentDirection(user.language);
      writeStoredLanguage(user.language);
    }
  }, [user]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      applyDocumentDirection(lang);
      writeStoredLanguage(lang);
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

/**
 * `t('Some English label')` — translates a literal UI string to Arabic
 * when that's the active language (via the dictionary in `./i18n/dictionary`),
 * or returns it unchanged for English / anything not yet translated.
 * Used throughout the shared chrome (AppShell, CrudPage/CrudPanel, login)
 * so every module page gets bilingual labels for free without each page
 * needing its own translation wiring.
 */
export function useT(): (text: string) => string {
  const { language } = useLanguage();
  return useCallback((text: string) => translate(text, language), [language]);
}

/**
 * `n(123)` — renders a number (or digit-bearing string like "12 · 450") in
 * Arabic-Indic numerals when Arabic is active, unchanged otherwise. Used
 * anywhere raw counts/amounts are shown outside the dictionary's exact-
 * string chrome translations (e.g. dashboard stats, pluralized alert text).
 */
export function useLocalizedDigits(): (value: string | number) => string {
  const { language } = useLanguage();
  return useCallback((value: string | number) => localizeDigits(value, language), [language]);
}

/**
 * Like `useLocalizedDigits`, but also swaps the "SAR" currency code for its
 * Arabic word. Used for dashboard stat-card values that mix a count/amount
 * with that unit in one string (e.g. "12 · 450 SAR").
 */
export function useLocalizedStatValue(): (value: string | number) => string {
  const { language } = useLanguage();
  return useCallback((value: string | number) => localizeStatValue(value, language), [language]);
}
