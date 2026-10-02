'use client';

import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiKeyDto, apiKeysApi, CreatedApiKeyDto } from '../../lib/api/api-keys.api';
import { errorMessage } from '../../lib/api/errors';
import { queryKeys } from '../../lib/api/query-keys';
import type { PermissionDto } from '../../lib/api/roles.api';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { useAuth } from '../auth/session-provider';
import { usePagedList } from '../crud/use-paged-list';
import { emptyPermissions } from '../roles/PermissionMatrix';
import { usePermissionModules } from '../roles/roles.queries';

/** Account administration can never be delegated to a key (the backend refuses these too). */
const NOT_GRANTABLE = ['users', 'roles', 'apiKeys'];

interface Draft {
  name: string;
  scopes: PermissionDto[];
  idempotencyKey: string;
}

/** State and actions of the API keys screen: list, create (key shown once), revoke. */
export function useApiKeysViewModel() {
  const t = useT();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = usePagedList(apiKeysApi, { errorFallback: 'Failed to load data.' });
  const { allowed } = list;
  const modules = usePermissionModules();

  /** Only modules the signed-in user can at least view are offered: nobody can grant what they lack. */
  const grantable = useMemo(() => (modules.data ?? []).filter((module) => !NOT_GRANTABLE.includes(module) && can(module, 'view')), [modules.data, can]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKeyDto | null>(null);

  const openCreate = useCallback(() => {
    setFormError(null);
    setDraft({ name: '', scopes: emptyPermissions(grantable), idempotencyKey: newIdempotencyKey() });
  }, [grantable]);
  const closeCreate = useCallback(() => setDraft(null), []);
  const patch = useCallback((changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current)), []);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.resource(apiKeysApi.key) });

  const create = useMutation({
    mutationFn: (values: Draft) => apiKeysApi.create({ name: values.name.trim(), scopes: values.scopes.filter((scope) => scope.canView || scope.canAdd || scope.canEdit || scope.canDelete) }, values.idempotencyKey),
    onSuccess: (result) => {
      invalidate();
      setDraft(null);
      setCreated(result);
    },
    onError: (error) => setFormError(errorMessage(error, 'Save failed.')),
  });

  const { mutate: runCreate, isPending: saving } = create;
  const save = useCallback(() => {
    if (!draft || saving) return;
    if (!draft.name.trim()) return setFormError('Enter a name for the key.');
    if (!draft.scopes.some((scope) => scope.canView || scope.canAdd || scope.canEdit || scope.canDelete)) return setFormError('Select at least one permission for the API key.');
    setFormError(null);
    runCreate(draft);
  }, [draft, saving, runCreate]);

  const revoke = useMutation({
    mutationFn: (key: ApiKeyDto) => apiKeysApi.revoke(key.id),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: 'teal', message: t('API key revoked.') });
    },
    onError: (error) => notifications.show({ color: 'red', message: t(errorMessage(error)) }),
  });

  return {
    ...list,
    canCreate: allowed.add && grantable.length > 0,
    draft,
    formError,
    saving,
    openCreate,
    closeCreate,
    patch,
    save,
    created,
    dismissCreated: () => setCreated(null),
    revoke: revoke.mutate,
    revokingId: revoke.isPending ? revoke.variables?.id : null,
  };
}
