'use client';

import { ActionIcon, Alert, Box, Button, Group, Modal, Stack, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { AppShell } from '../../components/AppShell';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import type { RoleDto } from '../../lib/api/roles.api';
import { useLocalizedDigits, useT } from '../../lib/language-context';
import { PermissionMatrix } from './PermissionMatrix';
import { useRolesViewModel } from './use-roles-view-model';

function RolesBody() {
  const vm = useRolesViewModel();
  const t = useT();
  const n = useLocalizedDigits();

  const columns: TableColumn<RoleDto>[] = [
    { id: 'name', header: 'Name', sortKey: 'name', cell: (role) => <Text span fw={600} fz="sm">{role.name}</Text> },
    { id: 'description', header: 'Description', cell: (role) => role.description || '—' },
    {
      id: 'access',
      header: 'Modules with access',
      cell: (role) => (role.name.trim().toUpperCase() === 'ADMIN' ? t('Full system access') : `${n(role.permissions.filter((permission) => permission.canView).length)} ${t('of')} ${n(role.permissions.length)}`),
    },
  ];

  const confirmDelete = (role: RoleDto) =>
    modals.openConfirmModal({
      title: `${t('Delete role')} "${role.name}"?`,
      children: <Text size="sm">{t('This cannot be undone.')}</Text>,
      labels: { confirm: t('Delete'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => void vm.remove(role),
    });

  return (
    <>
      <PageHeader title="Roles" description="Each role is a set of permissions; a user can do exactly what their role allows." />
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <TextInput value={vm.controls.search} onChange={(event) => vm.controls.setSearch(event.currentTarget.value)} placeholder={t('Role name')} aria-label={t('Search')} leftSection={<Icon.search size={15} />} w={{ base: '100%', xs: 260 }} />
          {vm.allowed.add && (
            <Button size="sm" leftSection={<Icon.plus size={15} />} onClick={vm.openCreate} disabled={!vm.modulesReady}>
              {t('Role')}
            </Button>
          )}
        </Group>
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
                  <>
                    {vm.allowed.edit && (
                      <Tooltip label={t('Edit')} withArrow>
                        <ActionIcon variant="subtle" color="gray" aria-label={t('Edit')} disabled={!vm.modulesReady} onClick={() => vm.openEdit(role)}>
                          <Icon.pencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {vm.allowed.delete && (
                      <Tooltip label={t('Delete')} withArrow>
                        <ActionIcon variant="subtle" color="red" aria-label={t('Delete')} onClick={() => confirmDelete(role)}>
                          <Icon.trash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </>
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
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={vm.close} disabled={vm.saving}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" loading={vm.saving}>
                  {t('Save')}
                </Button>
              </Group>
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
