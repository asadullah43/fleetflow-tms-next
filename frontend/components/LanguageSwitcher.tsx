'use client';

import { useLanguage } from '../lib/language-context';
import { Icon } from './icons';

/**
 * EN / AR segmented toggle. Placed on the login screen and in the main
 * app's topbar — the same two spots the legacy app's switcher lived in.
 * Switching flips the page's direction immediately (RTL for Arabic) and,
 * once signed in, is saved to the user's profile.
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      <Icon.globe size={14} />
      <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
        EN
      </button>
      <button type="button" className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>
        عربي
      </button>
    </div>
  );
}
