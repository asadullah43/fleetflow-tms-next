import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import { AuthProvider } from '../lib/auth-context';
import { LanguageProvider } from '../lib/language-context';
import './globals.css';

// Self-hosted via @fontsource (npm) rather than next/font/google: no
// external network call at build or runtime, so this builds reliably
// behind restrictive networks (CI, locked-down Docker builds). IBM Plex
// Sans has a matching Arabic companion family (IBM Plex Sans Arabic) — a
// functional reason to pick it for this bilingual EN/AR app, not just a
// look. Plex Mono is used for tabular/numeric data (plate numbers,
// amounts, dates) so dense tables stay easy to scan. Font family names
// wired to the CSS variables in globals.css.

export const metadata: Metadata = {
  title: 'FleetFlow TMS',
  description: 'Transport Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
