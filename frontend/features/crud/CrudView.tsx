'use client';

import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { ActionIcon, Alert, Anchor, Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { AsyncSelect } from '../../components/AsyncSelect';
import { DataTable, TableColumn } from '../../components/DataTable';
import { FormField } from '../../components/FormField';
import { Icon } from '../../components/icons';
import { StatusBadge } from '../../components/StatusBadge';
import type { ColumnDef, CrudDefinition, DisplayContext, FilterDef, RowAction } from './types';
import type { CrudViewModel } from './use-crud-view-model';

function renderCell<T>(column: ColumnDef<T>, row: T, ctx: DisplayContext): ReactNode {
  const value = column.value(row, ctx);
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  if (column.kind === 'status') return value ? <StatusBadge status={String(value)} /> : '—';
  const content =
    column.kind === 'mono' ? (
      <Text span ff="monospace" fz="sm" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {text}
      </Text>
    ) : (
      text
    );
  if (column.href) {
    return (
      <Anchor component={Link} href={column.href(row)} fw={600} c="brand.7" underline="hover">
        {content}
      </Anchor>
    );
  }
  return content;
}

function FilterControl({ filter, value, onChange, ctx }: { filter: FilterDef; value: string; onChange: (value: string) => void; ctx: DisplayContext }) {
  const label = ctx.t(filter.label);
  if (filter.type === 'lookup' && filter.lookup) return <AsyncSelect lookup={filter.lookup} value={value} onChange={onChange} placeholder={label} aria-label={label} w={190} />;
  if (filter.type === 'date') {
    return <DateInput value={value || null} onChange={(next) => onChange(next ?? '')} valueFormat="YYYY-MM-DD" placeholder={label} aria-label={label} clearable w={150} size="sm" popoverProps={{ withinPortal: true }} />;
  }
  return (
    <Select
      data={(filter.options ?? []).map((option) => ({ value: option.value, label: ctx.t(option.label) }))}
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

interface CrudViewProps<T extends { id: number }> {
  definition: CrudDefinition<T>;
  vm: CrudViewModel<T>;
  rowActions?: RowAction<T>[];
}

/**
 * The View of a CRUD screen: toolbar (search, filters, export, add), the
 * server-paged table, and the add/edit form. Purely presentational —
 * all state and behaviour come from the view model.
 */
export function CrudView<T extends { id: number }>({ definition, vm, rowActions = [] }: CrudViewProps<T>) {
  const { ctx, allowed, controls } = vm;
  const { t } = ctx;

  const columns = useMemo<TableColumn<T>[]>(
    () => definition.columns.map((column) => ({ id: column.header, header: column.header, align: column.align, sortKey: column.sortKey, cell: (row: T) => renderCell(column, row, ctx) })),
    [definition.columns, ctx],
  );

  const confirmDelete = (row: T) =>
    modals.openConfirmModal({
      title: t('Delete this record?'),
      children: <Text size="sm">{t('This cannot be undone.')}</Text>,
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => void vm.remove(row),
    });

  const hasRowActions = rowActions.length > 0 || allowed.edit || allowed.delete;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Group gap="sm" style={{ flex: 1 }}>
          <TextInput
            value={controls.search}
            onChange={(event) => controls.setSearch(event.currentTarget.value)}
            placeholder={t(definition.searchPlaceholder ?? 'Search...')}
            aria-label={t('Search')}
            leftSection={<Icon.search size={15} />}
            w={{ base: '100%', xs: 260 }}
          />
          {definition.filters?.map((filter) => (
            <FilterControl key={filter.name} filter={filter} value={controls.filters[filter.name] ?? ''} onChange={(value) => controls.setFilter(filter.name, value)} ctx={ctx} />
          ))}
          {controls.hasCriteria && (
            <Button variant="subtle" color="gray" size="sm" onClick={controls.clearFilters}>
              {t('Clear filters')}
            </Button>
          )}
        </Group>
        <Group gap="xs">
          <Button variant="default" size="sm" leftSection={<Icon.gridLayers size={15} />} loading={vm.exporting} onClick={() => void vm.exportRows('csv')}>
            {t('Excel')}
          </Button>
          <Button variant="default" size="sm" leftSection={<Icon.fileText size={15} />} disabled={vm.exporting} onClick={() => void vm.exportRows('pdf')}>
            {t('PDF')}
          </Button>
          {allowed.add && (
            <Button size="sm" leftSection={<Icon.plus size={15} />} onClick={vm.openCreate}>
              {t(definition.addLabel)}
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        rows={vm.rows}
        rowKey={(row) => row.id}
        loading={vm.loading}
        fetching={vm.fetching}
        error={vm.listError}
        emptyLabel={controls.hasCriteria ? 'No matching records.' : definition.emptyLabel}
        sort={controls.sort}
        onSortChange={controls.setSort}
        pagination={vm.pagination}
        onPageChange={controls.setPage}
        onPageSizeChange={controls.setPageSize}
        actions={
          hasRowActions
            ? (row) => (
                <>
                  {rowActions.map((action) => {
                    const ActionGlyph = Icon[action.icon];
                    return (
                      <Tooltip key={action.label} label={t(action.label)} withArrow>
                        <ActionIcon variant="subtle" color="gray" aria-label={t(action.label)} onClick={() => action.onClick(row)}>
                          <ActionGlyph size={16} />
                        </ActionIcon>
                      </Tooltip>
                    );
                  })}
                  {allowed.edit && (
                    <Tooltip label={t('Edit')} withArrow>
                      <ActionIcon variant="subtle" color="gray" aria-label={t('Edit')} onClick={() => vm.openEdit(row)}>
                        <Icon.pencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {allowed.delete && (
                    <Tooltip label={t('Delete')} withArrow>
                      <ActionIcon variant="subtle" color="red" aria-label={t('Delete')} loading={vm.deletingId === row.id} onClick={() => confirmDelete(row)}>
                        <Icon.trash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </>
              )
            : undefined
        }
      />

      <Modal opened={vm.editor !== null} onClose={vm.closeEditor} title={vm.editor?.mode === 'edit' ? `${t('Edit')} — ${t(definition.addLabel)}` : `${t('Add')} — ${t(definition.addLabel)}`} size="lg" closeOnClickOutside={false}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void vm.save();
          }}
        >
          <Stack gap="md">
            {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
            <SimpleGrid cols={{ base: 1, sm: definition.fields.length > 4 ? 2 : 1 }} spacing="md">
              {definition.fields.map((field) => (
                <FormField key={field.name} field={field} values={vm.values} error={vm.fieldErrors[field.name]} ctx={ctx} onChange={vm.setValue} mode={vm.editor?.mode ?? 'create'} />
              ))}
            </SimpleGrid>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={vm.closeEditor} disabled={vm.saving}>
                {t('Cancel')}
              </Button>
              <Button type="submit" loading={vm.saving}>
                {t('Save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
