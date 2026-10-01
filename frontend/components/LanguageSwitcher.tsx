'use client';

import { SegmentedControl } from '@mantine/core';
import { Language, useLanguage } from '../lib/language-context';

/**
 * EN / AR toggle, on the sign-in screen and in the top bar. Switching
 * flips the page's direction immediately (RTL for Arabic) and, once
 * signed in, is saved to the user's profile.
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <SegmentedControl
      size="xs"
      radius="md"
      aria-label="Language"
      value={language}
      onChange={(value) => setLanguage(value as Language)}
      data={[
        { value: 'en', label: 'EN' },
        { value: 'ar', label: 'عربي' },
      ]}
    />
  );
}
