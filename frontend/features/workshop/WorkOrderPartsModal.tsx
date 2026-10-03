'use client';

import { Alert, Button, Group, Modal, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { Mono } from '../../components/Mono';
import type { WorkOrderDto, WorkOrderPartDto } from '../../lib/api/workshop.api';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { StockPickerFields, useAvailableHint } from '../inventory/StockPickerFields';
import { useWorkOrderParts } from './use-work-order-parts';

function PartsBody({ workOrderId }: { workOrderId: number }) {
  const vm = useWorkOrderParts(workOrderId);
  const t = useT();
  const { language } = useLanguage();
  const confirmDanger = useConfirmDanger();
  const available = useAvailableHint(vm.picker);

  const columns: TableColumn<WorkOrderPartDto>[] = [
    { id: 'item', header: 'Item', cell: (row) => `${localizedJoinedName(row.itemName, row.itemNameAr, language)}${row.itemNumber ? ` (${row.itemNumber})` : ''}` },
    { id: 'warehouse', header: 'Warehouse', cell: (row) => localizedJoinedName(row.warehouseName, row.warehouseNameAr, language) },
    { id: 'qty', header: 'Qty', align: 'right', cell: (row) => <Mono fw={600}>{row.quantity}</Mono> },
    { id: 'unit', header: 'Unit cost', align: 'right', cell: (row) => <Mono>{row.unitCost}</Mono> },
    { id: 'total', header: 'Line total', align: 'right', cell: (row) => <Mono fw={600}>{row.totalCost}</Mono> },
  ];

  return (
    <Stack gap="md">
      {vm.order && (
        <Group gap="lg">
          <Text size="sm">
            {t('Parts cost')}: <Mono fw={600}>{vm.order.partsCost}</Mono>
          </Text>
          <Text size="sm">
            {t('Labor cost')}: <Mono>{vm.order.laborCost}</Mono>
          </Text>
          <Text size="sm">
            {t('Total cost')}: <Mono fw={700}>{vm.order.totalCost}</Mono>
          </Text>
        </Group>
      )}
      <DataTable
        columns={columns}
        rows={vm.lines.rows}
        rowKey={(row) => row.id}
        loading={vm.lines.loading}
        fetching={vm.lines.fetching}
        error={vm.lines.error}
        emptyLabel="No inventory used on this work order yet."
        actions={
          vm.allowed.remove
            ? (row) => (
                <ActionMenu
                  items={[
                    actions.remove(
                      () =>
                        confirmDanger({
                          title: t('Remove this item from the work order?'),
                          message: 'Its quantity goes back to the warehouse it came from, and its cost comes off the work order.',
                          confirmLabel: 'Remove',
                          onConfirm: () => vm.remove(row.id),
                        }),
                      { loading: vm.removingId === row.id },
                    ),
                  ]}
                />
              )
            : undefined
        }
      />
      {vm.allowed.add && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t("Taken from the warehouse you choose, at the item's unit cost, and added to this work order's parts cost.")}
            </Text>
            {vm.error && <Alert color="red">{t(vm.error)}</Alert>}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <StockPickerFields picker={vm.picker} />
              <TextInput label={t('Quantity')} required inputMode="numeric" dir="ltr" value={vm.quantity} onChange={(event) => vm.setQuantity(event.currentTarget.value)} description={available} />
            </SimpleGrid>
            <Button leftSection={<Icon.plus size={15} />} loading={vm.saving} onClick={vm.submit} style={{ alignSelf: 'flex-start' }}>
              {t('Use from stock')}
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

/** "Inventory used" on a work order. Keyed by order, so each order opens with a fresh form. */
export function WorkOrderPartsModal({ order, onClose }: { order: WorkOrderDto | null; onClose: () => void }) {
  const t = useT();
  return (
    <Modal opened={order !== null} onClose={onClose} title={`${t('Inventory used')} — ${order?.orderNumber ?? ''}`} size="xl" closeOnClickOutside={false}>
      {order && <PartsBody key={order.id} workOrderId={order.id} />}
    </Modal>
  );
}
