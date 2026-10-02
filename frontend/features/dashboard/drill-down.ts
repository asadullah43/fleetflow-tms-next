'use client';

import { useCallback } from 'react';
import { navItemFor } from '../../lib/nav-config';
import { moduleForPath } from '../../lib/permissions';
import { statusLabel } from '../../lib/status';
import { useListStore } from '../../stores/list.store';
import { useLocalizedDigits, useT } from '../../lib/language-context';
import { useAuth } from '../auth/session-provider';

/** Where a dashboard figure leads: a list page, opened with the filters that reproduce the figure (as far as the list's filters allow). */
export interface DrillDown {
  href: string;
  filters?: Record<string, string>;
}

export interface ResolvedDrillDown {
  href: string;
  /** Presets the target list's filters; call it as the navigation starts. */
  onNavigate: () => void;
  /** "Open Trucks · Active" — what the click will show. */
  hint: string;
}

/**
 * Resolves dashboard drill-downs. A figure only becomes a link when the
 * user may view the page it leads to; following it opens that list
 * already narrowed (via the list store), with search and paging reset.
 */
export function useDrillDown() {
  const { can } = useAuth();
  const preset = useListStore((store) => store.preset);
  const t = useT();
  const n = useLocalizedDigits();
  return useCallback(
    (target: DrillDown | undefined): ResolvedDrillDown | null => {
      if (!target) return null;
      const pageModule = moduleForPath(target.href);
      if (pageModule && !can(pageModule, 'view')) return null;
      const filters = target.filters ?? {};
      const page = navItemFor(target.href);
      const narrowed = Object.values(filters).map((value) => (/^[A-Z_]+$/.test(value) ? t(statusLabel(value)) : n(value)));
      return {
        href: target.href,
        onNavigate: () => preset(target.href, filters),
        hint: [`${t('Open')} ${page ? t(page.label) : ''}`.trim(), ...narrowed].join(' · '),
      };
    },
    [can, preset, t, n],
  );
}
