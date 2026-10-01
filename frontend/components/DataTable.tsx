'use client';

import { ReactNode } from 'react';
import { Alert, Box, Center, Group, Loader, Pagination as Pager, Paper, Select, Table, Text, UnstyledButton } from '@mantine/core';
import type { Pagination } from '../lib/api/types';
import { useLocalizedDigits, useT } from '../lib/language-context';
import { Icon } from './icons';

export interface TableColumn<T> {
  /** Stable id (also the React key). */
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** The server-side sort field this column sorts by; omit for non-sortable columns. */
  sortKey?: string;
}

export interface SortState {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  /** First load: nothing to show yet. */
  loading: boolean;
  /** A refetch is running while the previous page is still displayed. */
  fetching?: boolean;
  error?: string | null;
  emptyLabel: string;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Renders the trailing actions cell for a row. */
  actions?: (row: T) => ReactNode;
}

const PAGE_SIZES = ['10', '20', '50', '100'];

/** asc -> desc -> unsorted */
function nextSort(current: SortState | null | undefined, sortKey: string): SortState | null {
  if (current?.sortBy !== sortKey) return { sortBy: sortKey, sortOrder: 'asc' };
  return current.sortOrder === 'asc' ? { sortBy: sortKey, sortOrder: 'desc' } : null;
}

/**
 * The one table used for every list: server-driven sorting and paging,
 * with loading, error and empty states built in. It never sorts, filters
 * or slices rows itself — it displays the page the server returned.
 */
export function DataTable<T>({ columns, rows, rowKey, loading, fetching, error, emptyLabel, sort, onSortChange, pagination, onPageChange, onPageSizeChange, actions }: DataTableProps<T>) {
  const t = useT();
  const n = useLocalizedDigits();
  const total = pagination?.totalItems ?? rows?.length ?? 0;
  const first = pagination && total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const last = pagination ? Math.min(pagination.page * pagination.pageSize, total) : total;

  return (
    <Paper>
      {error && (
        <Alert color="red" m="md" title={t('Could not load this list')}>
          {t(error)}
        </Alert>
      )}

      {loading ? (
        <Center py={64}>
          <Loader aria-label={t('Loading...')} />
        </Center>
      ) : !rows || rows.length === 0 ? (
        !error && (
          <Center py={64} px="lg">
            <Text c="dimmed" size="sm" ta="center">
              {t(emptyLabel)}
            </Text>
          </Center>
        )
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table style={{ opacity: fetching ? 0.6 : 1, transition: 'opacity 120ms ease' }} aria-busy={fetching}>
            <Table.Thead>
              <Table.Tr>
                {columns.map((column) => {
                  const active = sort?.sortBy === column.sortKey;
                  return (
                    <Table.Th key={column.id} ta={column.align ?? 'left'} c="dimmed" fz="xs" fw={600} aria-sort={active ? (sort?.sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {column.sortKey && onSortChange ? (
                        <UnstyledButton fz="inherit" fw="inherit" c={active ? 'brand.7' : 'inherit'} onClick={() => onSortChange(nextSort(sort, column.sortKey as string))}>
                          <Group gap={4} wrap="nowrap" justify={column.align === 'right' ? 'flex-end' : 'flex-start'}>
                            {t(column.header)}
                            <Box opacity={active ? 1 : 0.35} style={{ transform: active && sort?.sortOrder === 'asc' ? 'rotate(180deg)' : undefined }}>
                              <Icon.chevronDown size={12} />
                            </Box>
                          </Group>
                        </UnstyledButton>
                      ) : (
                        t(column.header)
                      )}
                    </Table.Th>
                  );
                })}
                {actions && (
                  <Table.Th ta="right" c="dimmed" fz="xs" fw={600}>
                    {t('Actions')}
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <Table.Td key={column.id} ta={column.align ?? 'left'}>
                      {column.cell(row)}
                    </Table.Td>
                  ))}
                  {actions && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {actions(row)}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {pagination && onPageChange && total > 0 && (
        <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-sand-2)' }}>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {n(first)}–{n(last)} {t('of')} {n(total)}
            </Text>
            {onPageSizeChange && (
              <Select
                size="xs"
                w={76}
                aria-label={t('Rows per page')}
                data={PAGE_SIZES}
                value={String(pagination.pageSize)}
                onChange={(value) => value && onPageSizeChange(Number(value))}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
            )}
          </Group>
          <Pager size="sm" total={Math.max(1, pagination.totalPages)} value={pagination.page} onChange={onPageChange} />
        </Group>
      )}
    </Paper>
  );
}
