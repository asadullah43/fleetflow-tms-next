'use client';

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useDebouncedValue } from '@mantine/hooks';
import type { SortState } from '../../components/DataTable';
import { DEFAULT_PAGE_SIZE, ListQuery } from '../../lib/api/types';
import { EMPTY_LIST, ListState, useListStore } from '../../stores/list.store';

export const SEARCH_DEBOUNCE_MS = 400;

interface ListControlsOptions {
  /** Which list this is; defaults to the current page's path (one list per page). */
  scope?: string;
  initialPageSize?: number;
}

/**
 * The state behind every server-driven list: search text (debounced
 * before it reaches the server), filters, sort and page. It lives in the
 * list store, so it survives navigating away and back. Changing what is
 * being looked at always returns to the first page.
 */
export function useListControls({ scope, initialPageSize = DEFAULT_PAGE_SIZE }: ListControlsOptions = {}) {
  const pathname = usePathname();
  const key = scope ?? pathname;
  const stored = useListStore((store) => store.lists[key]);
  const patchStore = useListStore((store) => store.patch);
  const state: ListState = stored ?? (initialPageSize === DEFAULT_PAGE_SIZE ? EMPTY_LIST : { ...EMPTY_LIST, pageSize: initialPageSize });
  const { search, filters, sort, page, pageSize } = state;
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const patch = useCallback((changes: Partial<ListState>) => patchStore(key, changes, { pageSize: initialPageSize }), [patchStore, key, initialPageSize]);

  const setSearch = useCallback((text: string) => patch({ search: text, page: 1 }), [patch]);
  const setFilter = useCallback((name: string, value: string) => patch({ filters: { ...useListStore.getState().lists[key]?.filters, [name]: value }, page: 1 }), [patch, key]);
  const clearFilters = useCallback(() => patch({ filters: {}, search: '', page: 1 }), [patch]);
  const setSort = useCallback((next: SortState | null) => patch({ sort: next, page: 1 }), [patch]);
  const setPage = useCallback((next: number) => patch({ page: next }), [patch]);
  const setPageSize = useCallback((size: number) => patch({ pageSize: size, page: 1 }), [patch]);

  /** What is being looked at, without paging — reused by exports. */
  const criteria = useMemo<ListQuery>(() => ({ search: debouncedSearch, filters, sortBy: sort?.sortBy, sortOrder: sort?.sortOrder }), [debouncedSearch, filters, sort]);
  const query = useMemo<ListQuery>(() => ({ ...criteria, page, pageSize }), [criteria, page, pageSize]);
  const hasCriteria = debouncedSearch.trim() !== '' || Object.values(filters).some(Boolean);

  return { search, setSearch, filters, setFilter, clearFilters, sort, setSort, page, setPage, pageSize, setPageSize, criteria, query, hasCriteria };
}

export type ListControls = ReturnType<typeof useListControls>;
