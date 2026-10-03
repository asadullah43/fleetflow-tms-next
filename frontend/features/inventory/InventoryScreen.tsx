'use client';

import { Alert, Button, Paper, SegmentedControl, SimpleGrid, Stack, Tabs, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { AppShell } from '../../components/AppShell';
import { AsyncSelect } from '../../components/AsyncSelect';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { ListToolbar } from '../../components/ListToolbar';
import { Mono } from '../../components/Mono';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import type { InventoryMovementDto, StockLevelDto } from '../../lib/api/inventory.api';
import { formatDate, formatDateTime } from '../../lib/date';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { lookups } from '../crud/lookups';
import type { FilterDef } from '../crud/types';
import { StockPickerFields, useAvailableHint } from './StockPickerFields';
import { InventoryTab, InventoryViewModel, useInventoryViewModel } from './use-inventory-view-model';

const FORM_COLS = { base: 1, sm: 2, lg: 4 };

const STOCK_FILTERS: FilterDef[] = [
  { name: 'warehouseId', label: 'Warehouse', type: 'lookup', lookup: lookups.warehouses },
  { name: 'itemId', label: 'Item', type: 'lookup', lookup: lookups.inventoryItems },
  { name: 'inStock', label: 'Show', type: 'select', options: [{ value: 'IN_STOCK', label: 'In stock only' }] },
];
const MOVE_FILTERS: FilterDef[] = [
  { name: 'warehouseId', label: 'Warehouse', type: 'lookup', lookup: lookups.warehouses },
  { name: 'itemId', label: 'Item', type: 'lookup', lookup: lookups.inventoryItems },
  { name: 'fromDate', label: 'From Date', type: 'date' },
  { name: 'toDate', label: 'To Date', type: 'date' },
];

/** A paged list of the view model, whatever its rows. */
type PagedList<T> = Omit<InventoryViewModel['stock'], 'rows'> & { rows: T[] | undefined };

/** The toolbar + table pair every tab uses. */
function ListSection<T>({ list, columns, rowKey, filters, searchPlaceholder, emptyLabel }: { list: PagedList<T>; columns: TableColumn<T>[]; rowKey: (row: T) => number; filters: FilterDef[]; searchPlaceholder: string; emptyLabel: string }) {
  return (
    <Stack gap="md">
      <ListToolbar controls={list.controls} searchPlaceholder={searchPlaceholder} filters={filters} />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={rowKey}
        loading={list.loading}
        fetching={list.fetching}
        error={list.listError}
        emptyLabel={list.controls.hasCriteria ? 'No matching records.' : emptyLabel}
        sort={list.controls.sort}
        onSortChange={list.controls.setSort}
        pagination={list.pagination}
        onPageChange={list.controls.setPage}
        onPageSizeChange={list.controls.setPageSize}
      />
    </Stack>
  );
}

function useMovementColumns(): TableColumn<InventoryMovementDto>[] {
  const t = useT();
  const { language } = useLanguage();
  return [
    // The date the stock moved; when it was recorded is shown separately.
    { id: 'date', header: 'Movement date', sortKey: 'movementDate', cell: (row) => <Mono>{formatDate(row.movementDate)}</Mono> },
    { id: 'item', header: 'Item', cell: (row) => localizedJoinedName(row.itemName, row.itemNameAr, language) },
    { id: 'number', header: 'Item #', cell: (row) => <Mono>{row.itemNumber || '—'}</Mono> },
    { id: 'warehouse', header: 'Warehouse', cell: (row) => localizedJoinedName(row.warehouseName, row.warehouseNameAr, language) },
    { id: 'qty', header: 'Qty', align: 'right', sortKey: 'quantity', cell: (row) => <Mono fw={600}>{row.quantity}</Mono> },
    { id: 'cost', header: 'Unit cost', align: 'right', cell: (row) => <Mono>{row.unitCost}</Mono> },
    // A work order's movements already say so in their remarks ("Used on work order WO-00012").
    { id: 'recorded', header: 'Recorded', sortKey: 'createdAt', cell: (row) => <Mono>{formatDateTime(row.createdAt)}</Mono> },
    { id: 'remarks', header: 'Remarks', cell: (row) => row.remarks || (row.workOrderNumber ? `${t('Work order')} ${row.workOrderNumber}` : '—') },
  ];
}

/** The day the stock moved — today unless changed. Clearing it also means today. */
function MovementDate({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT();
  return <DateInput label={t('Movement date')} description={t('Today if left blank')} value={value || null} onChange={(next) => onChange(next ?? '')} valueFormat="YYYY-MM-DD" placeholder="YYYY-MM-DD" clearable popoverProps={{ withinPortal: true }} />;
}

function StockTab({ vm }: { vm: InventoryViewModel }) {
  const { language } = useLanguage();
  const columns: TableColumn<StockLevelDto>[] = [
    { id: 'item', header: 'Item', sortKey: 'itemName', cell: (row) => localizedJoinedName(row.itemName, row.itemNameAr, language) },
    { id: 'number', header: 'Item #', cell: (row) => <Mono>{row.itemNumber || '—'}</Mono> },
    { id: 'warehouse', header: 'Warehouse', sortKey: 'warehouseName', cell: (row) => localizedJoinedName(row.warehouseName, row.warehouseNameAr, language) },
    { id: 'qty', header: 'In this warehouse', align: 'right', sortKey: 'quantity', cell: (row) => <Mono fw={600}>{row.quantity}</Mono> },
    { id: 'total', header: 'All warehouses', align: 'right', cell: (row) => <Mono>{row.totalQuantity}</Mono> },
    { id: 'min', header: 'Min stock', align: 'right', cell: (row) => <Mono>{row.minimumStock}</Mono> },
    { id: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.itemStatus === 'ACTIVE' && row.totalQuantity <= row.minimumStock ? 'LOW_STOCK' : (row.itemStatus ?? 'ACTIVE')} /> },
  ];
  return <ListSection list={vm.stock} columns={columns} rowKey={(row) => row.id} filters={STOCK_FILTERS} searchPlaceholder="Item, item # or warehouse" emptyLabel="No stock yet — receive stock on the Stock in tab." />;
}

function StockInTab({ vm }: { vm: InventoryViewModel }) {
  const t = useT();
  const columns = useMovementColumns();
  const { form, setField } = vm.stockIn;
  const text = (name: keyof typeof form, label: string, required = false) => (
    <TextInput label={t(label)} required={required} value={form[name]} onChange={(event) => setField(name, event.currentTarget.value)} />
  );
  return (
    <Stack gap="md">
      {vm.allowed.add && (
        <Paper p="lg">
          <Stack gap="md">
            {vm.stockIn.error && <Alert color="red">{t(vm.stockIn.error)}</Alert>}
            <SegmentedControl
              value={form.mode}
              onChange={(value) => setField('mode', value)}
              data={[
                { value: 'existing', label: t('Existing item') },
                { value: 'new', label: t('New item') },
              ]}
              style={{ alignSelf: 'flex-start' }}
            />
            <SimpleGrid cols={FORM_COLS} spacing="md">
              {form.mode === 'existing' ? (
                <AsyncSelect label={t('Item')} required lookup={lookups.inventoryItems} value={form.itemId} onChange={(value) => setField('itemId', value)} />
              ) : (
                <>
                  {text('name', 'Name (English)', true)}
                  {text('nameAr', 'Name (Arabic)')}
                  {text('itemNumber', 'Item number / SKU')}
                  {text('category', 'Category')}
                  <TextInput label={t('Minimum stock level')} inputMode="numeric" dir="ltr" value={form.minimumStock} onChange={(event) => setField('minimumStock', event.currentTarget.value)} />
                  <TextInput label={t('Unit cost')} inputMode="decimal" dir="ltr" value={form.unitCost} onChange={(event) => setField('unitCost', event.currentTarget.value)} />
                </>
              )}
              <AsyncSelect label={t('Warehouse')} required lookup={lookups.warehouses} value={form.warehouseId} onChange={(value) => setField('warehouseId', value)} />
              <TextInput label={t('Quantity')} required inputMode="numeric" dir="ltr" value={form.quantity} onChange={(event) => setField('quantity', event.currentTarget.value)} />
              <MovementDate value={form.movementDate} onChange={(value) => setField('movementDate', value)} />
              {text('remarks', 'Remarks')}
            </SimpleGrid>
            <Button leftSection={<Icon.plus size={15} />} loading={vm.stockIn.saving} onClick={vm.stockIn.submit} style={{ alignSelf: 'flex-start' }}>
              {t('Receive stock')}
            </Button>
          </Stack>
        </Paper>
      )}
      <ListSection list={vm.ins} columns={columns} rowKey={(row) => row.id} filters={MOVE_FILTERS} searchPlaceholder="Item, warehouse or remarks" emptyLabel="Nothing received yet." />
    </Stack>
  );
}

function StockOutTab({ vm }: { vm: InventoryViewModel }) {
  const t = useT();
  const columns = useMovementColumns();
  const out = vm.stockOut;
  const available = useAvailableHint(out.picker);
  return (
    <Stack gap="md">
      {vm.allowed.add && (
        <Paper p="lg">
          <Stack gap="md">
            {out.error && <Alert color="red">{t(out.error)}</Alert>}
            <SimpleGrid cols={FORM_COLS} spacing="md">
              <StockPickerFields picker={out.picker} />
              <TextInput label={t('Quantity')} required inputMode="numeric" dir="ltr" value={out.quantity} onChange={(event) => out.setQuantity(event.currentTarget.value)} description={available} />
              <MovementDate value={out.movementDate} onChange={out.setMovementDate} />
              <TextInput label={t('Remarks')} placeholder={t('e.g. used for Truck TRK-003')} value={out.remarks} onChange={(event) => out.setRemarks(event.currentTarget.value)} />
            </SimpleGrid>
            <Button color="red" leftSection={<Icon.box size={15} />} loading={out.saving} onClick={out.submit} style={{ alignSelf: 'flex-start' }}>
              {t('Remove stock')}
            </Button>
          </Stack>
        </Paper>
      )}
      <ListSection list={vm.outs} columns={columns} rowKey={(row) => row.id} filters={MOVE_FILTERS} searchPlaceholder="Item, warehouse or remarks" emptyLabel="Nothing removed yet." />
    </Stack>
  );
}

function InventoryBody() {
  const vm = useInventoryViewModel();
  const t = useT();
  return (
    <>
      <PageHeader title="Inventory" description="Stock per warehouse. Stock in receives items (and adds new ones); Stock out removes them, never below what a warehouse holds." />
      <Tabs value={vm.tab} onChange={(value) => value && vm.setTab(value as InventoryTab)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="stock" leftSection={<Icon.box size={14} />}>
            {t('Stock levels')}
          </Tabs.Tab>
          <Tabs.Tab value="in" leftSection={<Icon.plus size={14} />}>
            {t('Stock in')}
          </Tabs.Tab>
          <Tabs.Tab value="out" leftSection={<Icon.clipboard size={14} />}>
            {t('Stock out')}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="stock">
          <StockTab vm={vm} />
        </Tabs.Panel>
        <Tabs.Panel value="in">
          <StockInTab vm={vm} />
        </Tabs.Panel>
        <Tabs.Panel value="out">
          <StockOutTab vm={vm} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

export function InventoryScreen() {
  return (
    <AppShell title="Inventory">
      <InventoryBody />
    </AppShell>
  );
}
