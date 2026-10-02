'use client';

import { ReactNode } from 'react';
import { Button, Group, Select, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { FilterDef } from '../features/crud/types';
import type { ListControls } from '../features/crud/use-list-controls';
import { useT } from '../lib/language-context';
import { tone } from '../theme/theme';
import { AsyncSelect } from './AsyncSelect';
import { Icon } from './icons';

function FilterControl({ filter, value, onChange }: { filter: FilterDef; value: string; onChange: (value: string) => void }) {
  const t = useT();
  const label = t(filter.label);
  if (filter.type === 'lookup' && filter.lookup) return <AsyncSelect lookup={filter.lookup} value={value} onChange={onChange} placeholder={label} aria-label={label} w={190} />;
  if (filter.type === 'date') {
    return <DateInput value={value || null} onChange={(next) => onChange(next ?? '')} valueFormat="YYYY-MM-DD" placeholder={label} aria-label={label} clearable w={150} size="sm" popoverProps={{ withinPortal: true }} />;
  }
  return (
    <Select
      data={(filter.options ?? []).map((option) => ({ value: option.value, label: t(option.label) }))}
      value={value || null}
      onChange={(next) => onChange(next ?? '')}
      placeholder={label}
      aria-label={label}
      clearable
      w={170}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

interface ListToolbarProps {
  controls: ListControls;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  /** Trailing actions — normally an <ActionMenu layout="button" />. */
  actions?: ReactNode;
}

/** The bar above every list: search, the list's server-side filters, "Clear filters", and the page's actions. */
export function ListToolbar({ controls, searchPlaceholder = 'Search...', filters = [], actions }: ListToolbarProps) {
  const t = useT();
  return (
    <Group justify="space-between" align="flex-start" gap="sm">
      <Group gap="sm" style={{ flex: 1 }}>
        <TextInput
          value={controls.search}
          onChange={(event) => controls.setSearch(event.currentTarget.value)}
          placeholder={t(searchPlaceholder)}
          aria-label={t('Search')}
          leftSection={<Icon.search size={15} />}
          w={{ base: '100%', xs: 260 }}
        />
        {filters.map((filter) => (
          <FilterControl key={filter.name} filter={filter} value={controls.filters[filter.name] ?? ''} onChange={(value) => controls.setFilter(filter.name, value)} />
        ))}
        {controls.hasCriteria && (
          <Button {...tone.secondary} size="sm" onClick={controls.clearFilters}>
            {t('Clear filters')}
          </Button>
        )}
      </Group>
      {actions}
    </Group>
  );
}
