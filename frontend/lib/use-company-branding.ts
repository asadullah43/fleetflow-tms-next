'use client';

import { useEffect, useState } from 'react';
import { companySettingsClient, CompanyBrandingDto } from './grpc/company-settings';

/**
 * Company name + logo, used wherever the app currently shows the
 * hardcoded "FleetFlow" brand (sidebar, login screen). Fetched once via
 * the public GetBranding RPC (no auth needed — the login screen calls
 * this before there's a session) and cached at module scope so every
 * page that mounts AppShell doesn't re-fetch it.
 *
 * After Company Settings saves a change, it calls setCompanyBranding()
 * directly so every mounted consumer (e.g. the sidebar) updates without
 * a page reload.
 */
const FALLBACK: CompanyBrandingDto = { companyName: 'FleetFlow' };

let cached: CompanyBrandingDto | null = null;
let inflight: Promise<CompanyBrandingDto> | null = null;
const listeners = new Set<(b: CompanyBrandingDto) => void>();

function load(): Promise<CompanyBrandingDto> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = companySettingsClient
      .getBranding()
      .then((b) => {
        cached = b;
        return b;
      })
      .catch(() => FALLBACK)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Call after a successful Company Settings save so every mounted
 *  sidebar/login screen picks up the new name/logo immediately. */
export function setCompanyBranding(branding: CompanyBrandingDto) {
  cached = branding;
  listeners.forEach((fn) => fn(branding));
}

export function useCompanyBranding(): { companyName: string; logoUrl: string | null } {
  const [branding, setBranding] = useState<CompanyBrandingDto>(cached ?? FALLBACK);

  useEffect(() => {
    listeners.add(setBranding);
    load().then(setBranding);
    return () => {
      listeners.delete(setBranding);
    };
  }, []);

  return {
    companyName: branding.companyName?.trim() || 'FleetFlow',
    logoUrl: branding.logoUrl?.trim() || null,
  };
}
