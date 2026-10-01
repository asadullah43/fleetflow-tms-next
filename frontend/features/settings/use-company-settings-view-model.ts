'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi, CompanySettingsDto } from '../../lib/api/company-settings.api';
import { errorMessage } from '../../lib/api/errors';
import { queryKeys } from '../../lib/api/query-keys';
import { useT } from '../../lib/language-context';
import { usePagePermissions } from '../auth/session-provider';
import { fileToLogoDataUrl } from './logo-image';

export const SETTINGS_FIELDS: { name: keyof CompanySettingsDto; label: string }[] = [
  { name: 'companyName', label: 'Company name' },
  { name: 'vatNumber', label: 'VAT number' },
  { name: 'crNumber', label: 'CR number' },
  { name: 'branchName', label: 'Branch name' },
  { name: 'industryCategory', label: 'Industry category' },
  { name: 'city', label: 'City' },
  { name: 'country', label: 'Country' },
  { name: 'address', label: 'Address' },
  { name: 'streetName', label: 'Street name' },
  { name: 'buildingNumber', label: 'Building number' },
  { name: 'postalCode', label: 'Postal code' },
  { name: 'bankName', label: 'Bank name' },
  { name: 'bankAccount', label: 'Bank account (IBAN)' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email' },
];

type Edits = Partial<Record<string, string>>;

/**
 * Company identity used across the app and on printed documents. The
 * form shows the saved settings overlaid with the user's unsaved edits,
 * so there is no copy of server data to keep in sync.
 */
export function useCompanySettingsViewModel() {
  const t = useT();
  const allowed = usePagePermissions();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: queryKeys.companySettings(), queryFn: companySettingsApi.get, enabled: allowed.view });

  const [edits, setEdits] = useState<Edits>({});
  const [logoError, setLogoError] = useState<string | null>(null);

  const valueOf = useCallback((name: string) => edits[name] ?? ((settings.data as Record<string, unknown> | undefined)?.[name] as string | undefined) ?? '', [edits, settings.data]);
  const setValue = useCallback((name: string, value: string) => setEdits((current) => ({ ...current, [name]: value })), []);

  const chooseLogo = useCallback(async (file: File | null) => {
    if (!file) return;
    setLogoError(null);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setEdits((current) => ({ ...current, logoUrl: dataUrl }));
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Could not process that image.');
    }
  }, []);

  const save = useMutation({
    mutationFn: (changes: Edits) => companySettingsApi.update(changes),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.companySettings(), saved);
      setEdits({});
      // The sidebar, sign-in screen, tab title and tab icon all read the branding query.
      void queryClient.invalidateQueries({ queryKey: queryKeys.branding() });
      notifications.show({ color: 'teal', message: t('Saved.') });
    },
  });

  const dirty = Object.keys(edits).length > 0;
  const nameMissing = valueOf('companyName').trim() === '';

  return {
    canEdit: allowed.edit,
    loading: settings.isPending && allowed.view,
    loadError: settings.isError ? errorMessage(settings.error) : null,
    valueOf,
    setValue,
    logoUrl: valueOf('logoUrl'),
    logoError,
    chooseLogo,
    removeLogo: () => setValue('logoUrl', ''),
    dirty,
    nameMissing,
    saving: save.isPending,
    saveError: save.isError ? errorMessage(save.error, 'Save failed.') : null,
    save: () => {
      if (dirty && !nameMissing && !save.isPending) save.mutate(edits);
    },
  };
}
