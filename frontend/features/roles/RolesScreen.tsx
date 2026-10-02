'use client';

import { Alert, Box, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { AppShell } from '../../components/AppShell';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { FormActions } from '../../components/FormActions';
import { ListToolbar } from '../../components/ListToolbar';
import { PageHeader } from '../../components/PageHeader';
import type { RoleDto } from '../../lib/api/roles.api';
import { useLocalizedDigits, useT } from '../../lib/language-context';
import { PermissionMatrix } from './PermissionMatrix';
import { useRolesViewModel } from './use-roles-view-model';

function RolesBody() {
  const vm = useRolesViewModel();
  const t = useT();
  const n = useLocalizedDigits();
  const confirmDanger = useConfirmDanger();

  const columns: TableColumn<RoleDto>[] = [
    { id: 'name', header: 'Name', sortKey: 'name', cell: (role) => <Text span fw={600} fz="sm">{role.name}</Text> },
    { id: 'description', header: 'Description', cell: (role) => role.description || '—' },
    {
      id: 'access',
      header: 'Modules with access',
      cell: (role) => (role.name.trim().toUpperCase() === 'ADMIN' ? t('Full system access') : `${n(role.permissions.filter((permission) => permission.canView).length)} ${t('of')} ${n(role.permissions.length)}`),
    },
  ];

  return (
    <>
      <PageHeader title="Roles" description="Each role is a set of permissions; a user can do exactly what their role allows." />
      <Stack gap="md">
        <ListToolbar
          controls={vm.controls}
          searchPlaceholder="Role name"
          actions={<ActionMenu layout="button" primary={actions.add('Role', vm.openCreate, { hidden: !vm.allowed.add, disabled: !vm.modulesReady })} />}
        />
        <DataTable
          columns={columns}
          rows={vm.rows}
          rowKey={(role) => role.id}
          loading={vm.loading}
          fetching={vm.fetching}
          error={vm.listError}
          emptyLabel={vm.controls.hasCriteria ? 'No matching records.' : 'No roles yet.'}
          sort={vm.controls.sort}
          onSortChange={vm.controls.setSort}
          pagination={vm.pagination}
          onPageChange={vm.controls.setPage}
          onPageSizeChange={vm.controls.setPageSize}
          actions={
            vm.allowed.edit || vm.allowed.delete
              ? (role) => (
                  <ActionMenu
                    items={[
                      actions.edit(() => vm.openEdit(role), { hidden: !vm.allowed.edit, disabled: !vm.modulesReady }),
                      actions.delete(() => confirmDanger({ title: `${t('Delete role')} "${role.name}"?`, onConfirm: () => void vm.remove(role) }), {
                        hidden: !vm.allowed.delete,
                        loading: vm.deletingId === role.id,
                      }),
                    ]}
                  />
                )
              : undefined
          }
        />
      </Stack>

      <Modal opened={vm.editor !== null} onClose={vm.close} title={vm.editor?.role ? `${t('Edit')} ${vm.editor.role.name}` : t('Add role')} size="lg" closeOnClickOutside={false}>
        {vm.editor && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void vm.save();
            }}
          >
            <Stack gap="md">
              {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
              <TextInput label={t('Role name')} required value={vm.editor.name} onChange={(event) => vm.patch({ name: event.currentTarget.value })} />
              <Textarea label={t('Description')} autosize minRows={2} value={vm.editor.description} onChange={(event) => vm.patch({ description: event.currentTarget.value })} />
              <Box>
                <Text size="sm" fw={500} mb={6}>
                  {t('Permissions')}
                </Text>
                <PermissionMatrix value={vm.editor.permissions} onChange={(permissions) => vm.patch({ permissions })} />
              </Box>
              <FormActions onCancel={vm.close} saving={vm.saving} />
            </Stack>
          </form>
        )}
      </Modal>
    </>
  );
}

export function RolesScreen() {
  return (
    <AppShell title="Roles">
      <RolesBody />
    </AppShell>
  );
}
