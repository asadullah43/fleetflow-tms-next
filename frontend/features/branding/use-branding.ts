'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/session-provider';
import { companySettingsApi } from '../../lib/api/company-settings.api';
import { queryKeys } from '../../lib/api/query-keys';

const FALLBACK_NAME = 'FleetFlow';

/**
 * Company name + logo for the sidebar, sign-in screen, browser tab and
 * tab icon. Signed in, it is the user's own company; signed out, the
 * default company. Saving Company Settings invalidates this query, so
 * every place updates at once.
 */
export function useBranding(): { companyName: string; logoUrl: string | null } {
  const { user, loading } = useAuth();
  const { data } = useQuery({
    // Keyed by company so a sign-in as another company never shows the previous one's brand.
    queryKey: [...queryKeys.branding(), user?.companyId ?? 'public'],
    queryFn: () => companySettingsApi.getBranding(),
    enabled: !loading,
    staleTime: 5 * 60_000,
  });
  return { companyName: data?.companyName?.trim() || FALLBACK_NAME, logoUrl: data?.logoUrl?.trim() || null };
}
