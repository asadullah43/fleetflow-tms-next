'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import type { SortState } from '../../components/DataTable';
import { DEFAULT_PAGE_SIZE, ListQuery } from '../../lib/api/types';

export const SEARCH_DEBOUNCE_MS = 400;

/**
 * The state behind every server-driven list: search text (debounced
 * before it reaches the server), filters, sort and page. Changing what
 * is being looked at always returns to the first page.
 */
export function useListControls(initialPageSize = DEFAULT_PAGE_SIZE) {
  const [search, setSearchText] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSortState] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setSearch = useCallback((text: string) => {
    setSearchText(text);
    setPage(1);
  }, []);
  const setFilter = useCallback((name: string, value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }, []);
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchText('');
    setPage(1);
  }, []);
  const setSort = useCallback((next: SortState | null) => {
    setSortState(next);
    setPage(1);
  }, []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  /** What is being looked at, without paging — reused by exports. */
  const criteria = useMemo<ListQuery>(() => ({ search: debouncedSearch, filters, sortBy: sort?.sortBy, sortOrder: sort?.sortOrder }), [debouncedSearch, filters, sort]);
  const query = useMemo<ListQuery>(() => ({ ...criteria, page, pageSize }), [criteria, page, pageSize]);
  const hasCriteria = debouncedSearch.trim() !== '' || Object.values(filters).some(Boolean);

  return { search, setSearch, filters, setFilter, clearFilters, sort, setSort, page, setPage, pageSize, setPageSize, criteria, query, hasCriteria };
}
