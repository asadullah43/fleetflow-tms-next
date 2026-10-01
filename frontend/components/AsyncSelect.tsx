'use client';

import { useMemo, useState } from 'react';
import { Loader, Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CrudApi } from '../lib/api/crud-api';
import { queryKeys } from '../lib/api/query-keys';
import { Language, useLanguage, useT } from '../lib/language-context';

/** A resource that can be picked from: which API to search and how to label a row. */
export interface Lookup<T extends { id: number } = { id: number }> {
  api: Pick<CrudApi<T>, 'key' | 'list' | 'get'>;
  label: (row: T, language: Language) => string;
  /** Server-side filters always applied (e.g. only ACTIVE rows). */
  filters?: Record<string, string>;
}

/** Helper that keeps the row type between `api` and `label`, then erases it for storage in field definitions. */
export function defineLookup<T extends { id: number }>(lookup: Lookup<T>): Lookup {
  return lookup as unknown as Lookup;
}

interface AsyncSelectProps {
  lookup: Lookup;
  /** The selected row's id as a string, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  clearable?: boolean;
  w?: number | string;
  'aria-label'?: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const OPTIONS_PER_SEARCH = 20;

/**
 * A dropdown that searches on the server as you type (debounced), so it
 * works the same with twenty customers or twenty thousand: only the
 * matching page of options is ever loaded. The current value's label is
 * fetched by id when it is not among the loaded options.
 */
export function AsyncSelect({ lookup, value, onChange, label, placeholder, required, disabled, error, clearable = true, w, ...rest }: AsyncSelectProps) {
  const t = useT();
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const selectedId = value ? Number(value) : null;

  const selected = useQuery({
    queryKey: queryKeys.detail(lookup.api.key, selectedId ?? 0),
    queryFn: () => lookup.api.get(selectedId as number),
    enabled: selectedId !== null,
    staleTime: 5 * 60_000,
  });
  const selectedLabel = selected.data ? lookup.label(selected.data, language) : '';

  // With a value chosen, the input shows that value's label — that is not a search.
  const term = debouncedSearch.trim() === selectedLabel ? '' : debouncedSearch.trim();
  const options = useQuery({
    queryKey: queryKeys.lookup(lookup.api.key, term, lookup.filters),
    queryFn: () => lookup.api.list({ search: term, pageSize: OPTIONS_PER_SEARCH, filters: lookup.filters }),
    placeholderData: keepPreviousData,
    enabled: !disabled,
  });

  const data = useMemo(() => {
    const rows = options.data?.items ?? [];
    const list = rows.map((row) => ({ value: String(row.id), label: lookup.label(row, language) }));
    if (selected.data && !rows.some((row) => row.id === selected.data.id)) list.unshift({ value: String(selected.data.id), label: selectedLabel });
    return list;
  }, [options.data, selected.data, selectedLabel, lookup, language]);

  return (
    <Select
      {...rest}
      label={label}
      placeholder={placeholder ?? t('Search...')}
      required={required}
      disabled={disabled}
      error={error ?? (options.isError ? t('Could not load options.') : undefined)}
      w={w}
      data={data}
      value={value || null}
      onChange={(next) => onChange(next ?? '')}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      // Filtering already happened on the server.
      filter={({ options: all }) => all}
      clearable={clearable && !required}
      nothingFoundMessage={options.isFetching ? t('Loading...') : t('No matching records.')}
      rightSection={options.isFetching ? <Loader size={14} /> : undefined}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
