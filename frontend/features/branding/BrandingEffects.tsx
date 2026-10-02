'use client';

import { usePathname } from 'next/navigation';
import { navItemFor } from '../../lib/nav-config';
import { useT } from '../../lib/language-context';
import { useBranding } from './use-branding';

/** The built-in tab icon, used until a company uploads a logo. */
const DEFAULT_ICON = '/icon.svg';

function pageLabel(pathname: string): string | null {
  const item = navItemFor(pathname);
  if (item) return item.label;
  return pathname.startsWith('/login') ? 'Sign in' : null;
}

/**
 * Keeps the browser tab in the company's identity: the tab icon is the
 * company logo (falling back to the built-in icon) and the tab title is
 * "<page> · <company>".
 *
 * Both are rendered as plain JSX rather than built with document.* calls:
 * React hoists <title> and <link> into <head> itself and keeps them current
 * on first paint and on every navigation, the same safe way it already
 * handled <title>. Imperatively removing/recreating the <link rel="icon">
 * node by hand used to race with Next's own head reconciliation during a
 * client-side route change and crash the render — see the note in
 * app/layout.tsx.
 */
export function BrandingEffects() {
  const { companyName, logoUrl } = useBranding();
  const pathname = usePathname();
  const t = useT();
  const label = pageLabel(pathname);
  const iconHref = logoUrl ?? DEFAULT_ICON;

  return (
    <>
      <title>{label ? `${t(label)} · ${companyName}` : companyName}</title>
      <link rel="icon" href={iconHref} type={iconHref.startsWith('data:image/png') ? 'image/png' : undefined} />
    </>
  );
}
