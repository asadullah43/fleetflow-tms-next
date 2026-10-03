'use client';

import { Alert, Button, Code, CopyButton, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { AppShell } from '../../components/AppShell';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { Mono } from '../../components/Mono';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import type { ApiKeyDto } from '../../lib/api/api-keys.api';
import { formatDateTime } from '../../lib/date';
import { useT } from '../../lib/language-context';
import { tone } from '../../theme/theme';
import type { FilterDef } from '../crud/types';
import { formatModule } from '../roles/PermissionMatrix';
import { PermissionsFormModal } from '../roles/PermissionsFormModal';
import { useApiKeysViewModel } from './use-api-keys-view-model';

const FILTERS: FilterDef[] = [
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'REVOKED', label: 'Revoked' },
    ],
  },
];

function ApiKeysBody() {
  const vm = useApiKeysViewModel();
  const t = useT();
  const confirmDanger = useConfirmDanger();

  const columns: TableColumn<ApiKeyDto>[] = [
    { id: 'name', header: 'Name', sortKey: 'name', cell: (key) => <Text span fw={600} fz="sm">{key.name}</Text> },
    { id: 'prefix', header: 'Key', cell: (key) => <Text span ff="monospace" fz="sm" dir="ltr">{key.keyPrefix}…</Text> },
    {
      id: 'scopes',
      header: 'Permissions',
      cell: (key) => (
        <Text size="xs" c="dimmed" maw={320} lineClamp={2}>
          {key.scopes.map((scope) => t(formatModule(scope.module))).join(', ')}
        </Text>
      ),
    },
    { id: 'lastUsed', header: 'Last used', sortKey: 'lastUsedAt', cell: (key) => <Mono>{formatDateTime(key.lastUsedAt, t('Never'))}</Mono> },
    { id: 'createdBy', header: 'Created by', cell: (key) => key.createdByName || '—' },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (key) => <StatusBadge status={key.status} /> },
  ];

  return (
    <>
      <PageHeader title="API Keys" description="Let other systems use FleetFlow on your company's behalf. Each key has only the permissions you give it and can be revoked at any time." />
      <Stack gap="md">
        <ListToolbar
          controls={vm.controls}
          searchPlaceholder="Key name"
          filters={FILTERS}
          actions={<ActionMenu layout="button" primary={actions.add('API key', vm.openCreate, { hidden: !vm.canCreate })} />}
        />

        <DataTable
          columns={columns}
          rows={vm.rows}
          rowKey={(key) => key.id}
          loading={vm.loading}
          fetching={vm.fetching}
          error={vm.listError}
          emptyLabel={vm.controls.hasCriteria ? 'No matching records.' : 'No API keys yet.'}
          sort={vm.controls.sort}
          onSortChange={vm.controls.setSort}
          pagination={vm.pagination}
          onPageChange={vm.controls.setPage}
          onPageSizeChange={vm.controls.setPageSize}
          actions={
            vm.allowed.delete
              ? (key) => (
                  <ActionMenu
                    items={[
                      actions.revoke(
                        () =>
                          confirmDanger({
                            title: `${t('Revoke API key')} "${key.name}"?`,
                            message: 'Anything using this key will stop working immediately. This cannot be undone.',
                            confirmLabel: 'Revoke',
                            onConfirm: () => vm.revoke(key),
                          }),
                        { hidden: key.status !== 'ACTIVE', loading: vm.revokingId === key.id },
                      ),
                    ]}
                  />
                )
              : undefined
          }
        />
      </Stack>

      <PermissionsFormModal
        opened={vm.draft !== null}
        onClose={vm.closeCreate}
        title={t('New API key')}
        onSubmit={() => vm.save()}
        error={vm.formError}
        fields={
          vm.draft && (
            <TextInput label={t('Name')} description={t('What will use this key, e.g. "Accounting sync".')} required value={vm.draft.name} onChange={(event) => vm.patch({ name: event.currentTarget.value })} />
          )
        }
        hint="Grant only what the integration needs. You can only grant permissions you have yourself."
        permissions={vm.draft?.scopes ?? []}
        onPermissionsChange={(scopes) => vm.patch({ scopes })}
        saving={vm.saving}
        submitLabel="Create key"
      />

      <Modal opened={vm.created !== null} onClose={vm.dismissCreated} title={t('Copy your new API key')} size="lg" closeOnClickOutside={false}>
        {vm.created && (
          <Stack gap="md">
            <Alert color="yellow">{t('This is the only time the key is shown. Store it somewhere safe now — it cannot be recovered later.')}</Alert>
            <Code block dir="ltr" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
              {vm.created.plaintextKey}
            </Code>
            <Text size="sm" c="dimmed">
              {t('Send it with each request as the header')} <Code>x-api-key</Code>.
            </Text>
            <Group justify="flex-end" gap="sm">
              <CopyButton value={vm.created.plaintextKey}>
                {({ copied, copy }) => (
                  <Button {...tone.secondary} onClick={copy}>
                    {copied ? t('Copied') : t('Copy key')}
                  </Button>
                )}
              </CopyButton>
              <Button onClick={vm.dismissCreated}>{t('Done')}</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export function ApiKeysScreen() {
  return (
    <AppShell title="API Keys">
      <ApiKeysBody />
    </AppShell>
  );
}
