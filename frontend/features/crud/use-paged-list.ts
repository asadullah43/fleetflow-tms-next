'use client';

import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import type { CrudApi } from '../../lib/api/crud-api';
import { errorMessage } from '../../lib/api/errors';
import { useT } from '../../lib/language-context';
import { usePagePermissions } from '../auth/session-provider';
import { useResourceList } from './crud.queries';
import { useListControls } from './use-list-controls';

interface PagedListOptions {
  /** Shown (translated) when the list fails to load. */
  errorFallback?: string;
  scope?: string;
  initialPageSize?: number;
  /** Extra condition for loading (e.g. only while a tab is open). */
  enabled?: boolean;
}

/**
 * Everything a screen needs to show one server-paged list: its controls
 * (search / filters / sort / page, kept in the list store) and the
 * current page with its loading and error states. Nothing is requested
 * when the user may not view the page.
 */
export function usePagedList<T>(source: Pick<CrudApi<T>, 'key' | 'list'>, { errorFallback = 'Failed to load data.', scope, initialPageSize, enabled = true }: PagedListOptions = {}) {
  const allowed = usePagePermissions();
  const controls = useListControls({ scope, initialPageSize });
  const active = enabled && allowed.view;
  const list = useResourceList(source, controls.query, active);
  return {
    allowed,
    controls,
    rows: list.data?.items,
    pagination: list.data?.pagination,
    loading: list.isPending && active,
    fetching: list.isFetching && !list.isPending,
    listError: list.isError ? errorMessage(list.error, errorFallback) : null,
  };
}

/** Wraps a delete mutation with the app's standard success / failure notices. */
export function useNotifiedRemove(removeAsync: (id: number) => Promise<unknown>) {
  const t = useT();
  return useCallback(
    async (id: number) => {
      try {
        await removeAsync(id);
        notifications.show({ color: 'teal', message: t('Record deleted.') });
      } catch (error) {
        notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(error, 'Delete failed.')) });
      }
    },
    [removeAsync, t],
  );
}
