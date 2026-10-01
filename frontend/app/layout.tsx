import type { Metadata } from 'next';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import { AppProviders } from '../providers/AppProviders';

// Fonts are self-hosted via @fontsource rather than next/font/google: no
// external network call at build or runtime. IBM Plex Sans has a matching
// Arabic family, so the EN and AR interfaces share one typographic voice;
// Plex Mono is used for tabular data (plate numbers, amounts, dates).

// The tab title ("<page> · <company>") and the tab icon (the company logo)
// are both rendered by features/branding/BrandingEffects.tsx as plain JSX
// (React hoists <title>/<link> into <head> itself). Deliberately no `icons`
// here: Next's own metadata-icon reconciler would then be managing the same
// <link rel="icon"> node as BrandingEffects, and the two fighting over one
// node during a client-side route change is what used to crash navigation
// (a "Cannot read properties of null (reading 'removeChild')" error that
// aborted the render, leaving the page needing a second click to catch up).
export const metadata: Metadata = {
  description: 'Transport Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
