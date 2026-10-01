'use client';

import { ActionIcon, Alert, Box, Button, Code, CopyButton, Group, Modal, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { AppShell } from '../../components/AppShell';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import type { ApiKeyDto } from '../../lib/api/api-keys.api';
import { formatDateTime } from '../../lib/date';
import { useT } from '../../lib/language-context';
import { formatModule, PermissionMatrix } from '../roles/PermissionMatrix';
import { useApiKeysViewModel } from './use-api-keys-view-model';

const KEY_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REVOKED', label: 'Revoked' },
];

function ApiKeysBody() {
  const vm = useApiKeysViewModel();
  const t = useT();

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
    { id: 'lastUsed', header: 'Last used', sortKey: 'lastUsedAt', cell: (key) => <Text span ff="monospace" fz="sm">{formatDateTime(key.lastUsedAt, t('Never'))}</Text> },
    { id: 'createdBy', header: 'Created by', cell: (key) => key.createdByName || '—' },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (key) => <StatusBadge status={key.status} /> },
  ];

  const confirmRevoke = (key: ApiKeyDto) =>
    modals.openConfirmModal({
      title: `${t('Revoke API key')} "${key.name}"?`,
      children: <Text size="sm">{t('Anything using this key will stop working immediately. This cannot be undone.')}</Text>,
      labels: { confirm: t('Revoke'), cancel: t('Cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => vm.revoke(key),
    });

  return (
    <>
      <PageHeader title="API Keys" description="Let other systems use FleetFlow on your company's behalf. Each key has only the permissions you give it and can be revoked at any time." />
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Group gap="sm">
            <TextInput value={vm.controls.search} onChange={(event) => vm.controls.setSearch(event.currentTarget.value)} placeholder={t('Key name')} aria-label={t('Search')} leftSection={<Icon.search size={15} />} w={{ base: '100%', xs: 260 }} />
            <Select
              data={KEY_STATUSES.map((status) => ({ value: status.value, label: t(status.label) }))}
              value={vm.controls.filters.status || null}
              onChange={(value) => vm.controls.setFilter('status', value ?? '')}
              placeholder={t('Status')}
              aria-label={t('Status')}
              clearable
              w={150}
            />
          </Group>
          {vm.canCreate && (
            <Button size="sm" leftSection={<Icon.plus size={15} />} onClick={vm.openCreate}>
              {t('API key')}
            </Button>
          )}
        </Group>

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
              ? (key) =>
                  key.status === 'ACTIVE' && (
                    <Tooltip label={t('Revoke')} withArrow>
                      <ActionIcon variant="subtle" color="red" aria-label={t('Revoke')} onClick={() => confirmRevoke(key)}>
                        <Icon.trash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )
              : undefined
          }
        />
      </Stack>

      <Modal opened={vm.draft !== null} onClose={vm.closeCreate} title={t('New API key')} size="lg" closeOnClickOutside={false}>
        {vm.draft && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              vm.save();
            }}
          >
            <Stack gap="md">
              {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
              <TextInput label={t('Name')} description={t('What will use this key, e.g. "Accounting sync".')} required value={vm.draft.name} onChange={(event) => vm.patch({ name: event.currentTarget.value })} />
              <Box>
                <Text size="sm" fw={500}>
                  {t('Permissions')}
                </Text>
                <Text size="xs" c="dimmed" mb={6}>
                  {t('Grant only what the integration needs. You can only grant permissions you have yourself.')}
                </Text>
                <PermissionMatrix value={vm.draft.scopes} onChange={(scopes) => vm.patch({ scopes })} />
              </Box>
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={vm.closeCreate} disabled={vm.saving}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" loading={vm.saving}>
                  {t('Create key')}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

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
                  <Button variant="default" onClick={copy}>
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
