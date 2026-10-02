'use client';

import { Alert, Button, Paper, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { AppShell } from '../../components/AppShell';
import { AsyncSelect } from '../../components/AsyncSelect';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { ListToolbar } from '../../components/ListToolbar';
import { Mono } from '../../components/Mono';
import { PageHeader } from '../../components/PageHeader';
import type { LoadingOrderBatchDto } from '../../lib/api/loading-orders.api';
import { formatDate } from '../../lib/date';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { lookups } from '../crud/lookups';
import { MAX_QUANTITY, useLoadingOrdersViewModel } from './use-loading-orders-view-model';

const serialRange = (batch: LoadingOrderBatchDto) => (batch.quantity > 1 ? `${batch.firstSerialNumber} – ${batch.lastSerialNumber}` : batch.firstSerialNumber);

function LoadingOrdersBody() {
  const vm = useLoadingOrdersViewModel();
  const t = useT();
  const { language } = useLanguage();
  const confirmDanger = useConfirmDanger();

  const columns: TableColumn<LoadingOrderBatchDto>[] = [
    { id: 'serial', header: 'Loading order #', sortKey: 'batchId', cell: (batch) => <Mono>{serialRange(batch)}</Mono> },
    { id: 'pickup', header: 'Pickup', cell: (batch) => localizedJoinedName(batch.pickupLocationName, batch.pickupLocationNameAr, language) },
    { id: 'delivery', header: 'Delivery', cell: (batch) => localizedJoinedName(batch.deliveryLocationName, batch.deliveryLocationNameAr, language) },
    { id: 'customer', header: 'Customer', cell: (batch) => localizedJoinedName(batch.customerName, batch.customerNameAr, language) },
    { id: 'cargo', header: 'Cargo', cell: (batch) => localizedJoinedName(batch.cargoTypeName, batch.cargoTypeNameAr, language) },
    { id: 'qty', header: 'Qty', align: 'right', cell: (batch) => <Mono fw={600}>{batch.quantity}</Mono> },
    { id: 'created', header: 'Generated on', cell: (batch) => <Mono>{formatDate(batch.createdAt)}</Mono> },
  ];

  return (
    <>
      <PageHeader title="Loading Orders" description="Generate loading order slips (Driver & Warehouse copies) for a route — the PDF opens in a new tab, ready to print or save." />
      <Stack gap="md">
        {vm.allowed.add && (
          <Paper p="lg">
            <Stack gap="md">
              {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
                <AsyncSelect label={t('Pickup location')} required lookup={lookups.locations} value={vm.form.pickupLocationId} onChange={(value) => vm.setField('pickupLocationId', value)} />
                <AsyncSelect label={t('Delivery location')} required lookup={lookups.locations} value={vm.form.deliveryLocationId} onChange={(value) => vm.setField('deliveryLocationId', value)} />
                <AsyncSelect label={t('Customer')} required lookup={lookups.customers} value={vm.form.customerId} onChange={(value) => vm.setField('customerId', value)} />
                <AsyncSelect label={t('Cargo type')} required lookup={lookups.cargoTypes} value={vm.form.cargoTypeId} onChange={(value) => vm.setField('cargoTypeId', value)} />
                <TextInput label={t('Quantity')} required inputMode="numeric" dir="ltr" value={vm.form.quantity} onChange={(event) => vm.setField('quantity', event.currentTarget.value)} placeholder={`1 – ${MAX_QUANTITY}`} />
              </SimpleGrid>
              <Button leftSection={<Icon.plus size={15} />} loading={vm.generating} onClick={vm.submit} style={{ alignSelf: 'flex-start' }}>
                {t('Generate loading order')}
              </Button>
            </Stack>
          </Paper>
        )}

        <ListToolbar controls={vm.controls} searchPlaceholder="Serial #, customer, location or cargo" />

        <DataTable
          columns={columns}
          rows={vm.rows}
          rowKey={(batch) => batch.batchId}
          loading={vm.loading}
          fetching={vm.fetching}
          error={vm.listError}
          emptyLabel={vm.controls.hasCriteria ? 'No matching records.' : 'No loading orders yet — generate your first batch above.'}
          sort={vm.controls.sort}
          onSortChange={vm.controls.setSort}
          pagination={vm.pagination}
          onPageChange={vm.controls.setPage}
          onPageSizeChange={vm.controls.setPageSize}
          actions={(batch) => (
            <ActionMenu
              primary={actions.openPdf(() => void vm.openPdf(batch), { loading: vm.openingBatchId === batch.batchId })}
              items={[
                actions.deleteBatch(() => confirmDanger({ title: `${t('Delete loading order batch')} ${serialRange(batch)}?`, onConfirm: () => void vm.remove(batch.batchId) }), {
                  hidden: !vm.allowed.delete,
                  loading: vm.deletingBatchId === batch.batchId,
                }),
              ]}
            />
          )}
        />
      </Stack>
    </>
  );
}

export function LoadingOrdersScreen() {
  return (
    <AppShell title="Loading Orders">
      <LoadingOrdersBody />
    </AppShell>
  );
}
