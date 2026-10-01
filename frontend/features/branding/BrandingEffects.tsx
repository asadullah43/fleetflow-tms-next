'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '../../lib/nav-config';
import { useT } from '../../lib/language-context';
import { useBranding } from './use-branding';

/** The built-in tab icon, used until a company uploads a logo. */
const DEFAULT_ICON = '/icon.svg';

function pageLabel(pathname: string): string | null {
  let best: { href: string; label: string } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  if (best) return best.label;
  return pathname.startsWith('/login') ? 'Sign in' : null;
}

function setIcon(href: string): void {
  // Replace every icon link rather than editing one: browsers pick the last, and Next may have added its own.
  document.querySelectorAll("link[rel~='icon']").forEach((link) => link.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  if (href.startsWith('data:image/png')) link.type = 'image/png';
  document.head.appendChild(link);
}

/**
 * Keeps the browser tab in the company's identity: the tab icon is the
 * company logo (falling back to the built-in icon) and the tab title is
 * "<page> · <company>".
 */
export function BrandingEffects() {
  const { companyName, logoUrl } = useBranding();
  const pathname = usePathname();
  const t = useT();
  const label = pageLabel(pathname);

  useEffect(() => {
    setIcon(logoUrl ?? DEFAULT_ICON);
  }, [logoUrl]);

  // React hoists <title> into <head> and keeps it current — on first paint and on every navigation.
  return <title>{label ? `${t(label)} · ${companyName}` : companyName}</title>;
}
