'use client';

import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { Alert, Anchor, Modal, SimpleGrid, Stack } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { FormActions } from '../../components/FormActions';
import { FormField } from '../../components/FormField';
import { ListToolbar } from '../../components/ListToolbar';
import { Mono } from '../../components/Mono';
import { StatusBadge } from '../../components/StatusBadge';
import { crudRowActions } from './row-actions';
import type { ColumnDef, CrudDefinition, DisplayContext, RowAction } from './types';
import type { CrudViewModel } from './use-crud-view-model';

function renderCell<T>(column: ColumnDef<T>, row: T, ctx: DisplayContext): ReactNode {
  const value = column.value(row, ctx);
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  if (column.kind === 'status') return value ? <StatusBadge status={String(value)} /> : '—';
  const content = column.kind === 'mono' ? <Mono>{text}</Mono> : text;
  if (column.href) {
    return (
      <Anchor component={Link} href={column.href(row)} fw={600} c="brand.7" underline="hover">
        {content}
      </Anchor>
    );
  }
  return content;
}

interface CrudViewProps<T extends { id: number }> {
  definition: CrudDefinition<T>;
  vm: CrudViewModel<T>;
  rowActions?: RowAction<T>[];
}

/**
 * The View of a CRUD screen: toolbar (search, filters, add + export menu),
 * the server-paged table with one action menu per row, and the add/edit
 * form. Purely presentational — all state and behaviour come from the
 * view model.
 */
export function CrudView<T extends { id: number }>({ definition, vm, rowActions = [] }: CrudViewProps<T>) {
  const { ctx, allowed, controls } = vm;
  const { t } = ctx;
  const confirmDanger = useConfirmDanger();

  const columns = useMemo<TableColumn<T>[]>(
    () => definition.columns.map((column) => ({ id: column.header, header: column.header, align: column.align, sortKey: column.sortKey, cell: (row: T) => renderCell(column, row, ctx) })),
    [definition.columns, ctx],
  );

  const rowMenu = (row: T) => {
    const { primary, items } = crudRowActions({
      allowed,
      custom: rowActions.map((action) => action(row)),
      onEdit: () => vm.openEdit(row),
      onDuplicate: () => vm.openDuplicate(row),
      onDelete: () => confirmDanger({ title: t('Delete this record?'), onConfirm: () => void vm.remove(row) }),
      deleting: vm.deletingId === row.id,
    });
    return <ActionMenu primary={primary} items={items} />;
  };

  const hasRowActions = rowActions.length > 0 || allowed.edit || allowed.add || allowed.delete;

  return (
    <Stack gap="md">
      <ListToolbar
        controls={controls}
        searchPlaceholder={definition.searchPlaceholder}
        filters={definition.filters}
        actions={
          <ActionMenu
            layout="button"
            primary={actions.add(definition.addLabel, vm.openCreate, { hidden: !allowed.add })}
            items={[actions.exportExcel(() => void vm.exportRows('csv'), { loading: vm.exporting }), actions.exportPdf(() => void vm.exportRows('pdf'), { disabled: vm.exporting })]}
          />
        }
      />

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
        actions={hasRowActions ? rowMenu : undefined}
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
            <FormActions onCancel={vm.closeEditor} saving={vm.saving} />
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
