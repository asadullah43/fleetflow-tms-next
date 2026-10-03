'use client';

import { Alert, Anchor, Box, Button, Checkbox, CloseButton, Code, Divider, Group, Modal, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { AppShell } from '../../components/AppShell';
import { AsyncSelect } from '../../components/AsyncSelect';
import { useConfirmDanger } from '../../components/confirm';
import { DataTable, TableColumn } from '../../components/DataTable';
import { FormActions } from '../../components/FormActions';
import { Icon } from '../../components/icons';
import { ListToolbar } from '../../components/ListToolbar';
import { Mono } from '../../components/Mono';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import type { InvoiceDto } from '../../lib/api/invoices.api';
import { formatDate } from '../../lib/date';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { tone } from '../../theme/theme';
import { lookups } from '../crud/lookups';
import type { FilterDef } from '../crud/types';
import { canSubmitToZatca, useInvoicesViewModel } from './use-invoices-view-model';

type ViewModel = ReturnType<typeof useInvoicesViewModel>;

const FILTERS: FilterDef[] = [
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'UNPAID', label: 'Unpaid' },
      { value: 'PAID', label: 'Paid' },
    ],
  },
  { name: 'customerId', label: 'Customer', type: 'lookup', lookup: lookups.customers },
];

function NewInvoiceModal({ vm }: { vm: ViewModel }) {
  const t = useT();
  const draft = vm.draft;
  const date = (name: 'fromDate' | 'toDate' | 'dueDate', label: string) => (
    <DateInput
      label={t(label)}
      required
      value={draft?.[name] || null}
      onChange={(value) => vm.patchDraft({ [name]: value ?? '' })}
      error={vm.draftErrors[name] ? t(vm.draftErrors[name]) : undefined}
      valueFormat="YYYY-MM-DD"
      placeholder="YYYY-MM-DD"
      popoverProps={{ withinPortal: true }}
    />
  );

  return (
    <Modal opened={draft !== null} onClose={vm.closeCreate} title={t('New invoice')} size="xl" closeOnClickOutside={false}>
      {draft && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void vm.save();
          }}
        >
          <Stack gap="md">
            {vm.formError && <Alert color="red">{t(vm.formError)}</Alert>}
            <AsyncSelect label={t('Customer')} required lookup={lookups.customers} value={draft.customerId} onChange={(customerId) => vm.patchDraft({ customerId })} error={vm.draftErrors.customerId ? t(vm.draftErrors.customerId) : undefined} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              {date('fromDate', 'From date')}
              {date('toDate', 'To date')}
              {date('dueDate', 'Due date')}
            </SimpleGrid>
            <AsyncSelect label={t('Trip')} lookup={lookups.trips} value={draft.tripId} onChange={(tripId) => vm.patchDraft({ tripId })} placeholder={t('The trip this invoice is for (optional)')} />
            <Checkbox label={t('Apply 15% VAT')} checked={draft.vatEnabled} onChange={(event) => vm.patchDraft({ vatEnabled: event.currentTarget.checked })} />

            <Box>
              <Text size="sm" fw={500} mb={6}>
                {t('Line items')}
              </Text>
              <Stack gap="xs">
                {draft.lines.map((line, index) => (
                  <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                    <TextInput
                      style={{ flex: 3 }}
                      placeholder={t('Description')}
                      aria-label={t('Description')}
                      value={line.description}
                      onChange={(event) => vm.setLine(index, { description: event.currentTarget.value })}
                      error={vm.lineErrors[index] ? t(vm.lineErrors[index]) : undefined}
                    />
                    <TextInput style={{ flex: 1 }} placeholder={t('Qty')} aria-label={t('Qty')} inputMode="decimal" dir="ltr" value={line.quantity} onChange={(event) => vm.setLine(index, { quantity: event.currentTarget.value })} />
                    <TextInput style={{ flex: 1 }} placeholder={t('Rate')} aria-label={t('Rate')} inputMode="decimal" dir="ltr" value={line.rate} onChange={(event) => vm.setLine(index, { rate: event.currentTarget.value })} />
                    <CloseButton mt={4} aria-label={t('Remove')} disabled={draft.lines.length === 1} onClick={() => vm.removeLine(index)} />
                  </Group>
                ))}
              </Stack>
              <Button {...tone.secondary} size="xs" mt="sm" leftSection={<Icon.plus size={13} />} onClick={vm.addLine}>
                {t('Add line')}
              </Button>
            </Box>

            <Stack gap={2} align="flex-end">
              <Text size="sm" c="dimmed">
                {t('Subtotal:')} <Mono>{vm.totals.subtotal}</Mono> {t('SAR')}
              </Text>
              {draft.vatEnabled && (
                <Text size="sm" c="dimmed">
                  {t('VAT:')} <Mono>{vm.totals.vat}</Mono> {t('SAR')}
                </Text>
              )}
              <Text fw={600}>
                {t('Total:')} <Mono>{vm.totals.total}</Mono> {t('SAR')}
              </Text>
            </Stack>

            <FormActions onCancel={vm.closeCreate} saving={vm.saving} submitLabel="Create invoice" />
          </Stack>
        </form>
      )}
    </Modal>
  );
}

function InvoiceModal({ vm }: { vm: ViewModel }) {
  const t = useT();
  const { language } = useLanguage();
  const invoice = vm.viewing;
  const canSubmit = invoice && canSubmitToZatca(invoice);

  return (
    <Modal opened={invoice !== null} onClose={vm.closeView} title={invoice ? `${t('Invoice')} ${invoice.invoiceNumber}` : ''} size="lg">
      {invoice && (
        <Stack gap="md">
          {vm.actionError && <Alert color="red">{t(vm.actionError)}</Alert>}
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <Text size="sm">
              {t('Customer:')} <b>{localizedJoinedName(invoice.customerName, invoice.customerNameAr, language) ?? invoice.customerId}</b>
            </Text>
            <Text size="sm">
              {t('Due:')} <Mono>{formatDate(invoice.dueDate)}</Mono>
            </Text>
            <Group gap="xs">
              <Text size="sm">{t('Status:')}</Text>
              <StatusBadge status={invoice.status} />
            </Group>
            <Group gap="xs">
              <Text size="sm">{t('ZATCA:')}</Text>
              <StatusBadge status={invoice.zatcaStatus ?? 'PENDING_SIGN'} />
            </Group>
            {!vm.allowed.edit && (
              <Text size="sm">
                {t('Trip:')} <Mono>{invoice.tripTransactionNumber ?? '—'}</Mono>
              </Text>
            )}
          </SimpleGrid>
          {vm.allowed.edit && (
            <AsyncSelect
              label={t('Trip')}
              lookup={lookups.trips}
              value={invoice.tripId ? String(invoice.tripId) : ''}
              onChange={(tripId) => void vm.linkTrip(tripId)}
              disabled={vm.linkingTrip}
              placeholder={t('The trip this invoice is for (optional)')}
            />
          )}

          <Table.ScrollContainer minWidth={420}>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Description')}</Table.Th>
                  <Table.Th ta="right">{t('Qty')}</Table.Th>
                  <Table.Th ta="right">{t('Rate')}</Table.Th>
                  <Table.Th ta="right">{t('Amount')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invoice.lineItems.map((line, index) => (
                  <Table.Tr key={line.id ?? index}>
                    <Table.Td>{line.description}</Table.Td>
                    <Table.Td ta="right"><Mono>{line.quantity}</Mono></Table.Td>
                    <Table.Td ta="right"><Mono>{line.rate}</Mono></Table.Td>
                    <Table.Td ta="right"><Mono>{line.amount}</Mono></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Stack gap={2} align="flex-end">
            <Text size="sm">
              {t('Subtotal:')} <Mono>{invoice.subtotal}</Mono>
            </Text>
            <Text size="sm">
              {t('VAT:')} <Mono>{invoice.vatAmount}</Mono>
            </Text>
            <Text fw={600}>
              {t('Total:')} <Mono>{invoice.total}</Mono> {invoice.currency}
            </Text>
          </Stack>

          {invoice.qrCode && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                {t('ZATCA QR (base64 TLV):')}
              </Text>
              <Code block style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                {invoice.qrCode}
              </Code>
            </Box>
          )}

          <Divider />
          <Group justify="flex-end" gap="sm">
            {vm.allowed.edit && invoice.status !== 'PAID' && (
              <Button {...tone.secondary} loading={vm.acting} onClick={() => void vm.markPaid()}>
                {t('Mark as paid')}
              </Button>
            )}
            {vm.allowed.edit && canSubmit && (
              <Button loading={vm.acting} onClick={() => void vm.submitToZatca()}>
                {t('Submit to ZATCA')}
              </Button>
            )}
            <Button {...tone.secondary} onClick={vm.closeView}>
              {t('Close')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function InvoicesBody() {
  const vm = useInvoicesViewModel();
  const t = useT();
  const { language } = useLanguage();
  const { controls } = vm;

  const columns: TableColumn<InvoiceDto>[] = [
    {
      id: 'number',
      header: 'Invoice #',
      sortKey: 'invoiceNumber',
      cell: (invoice) => (
        <Anchor component="button" type="button" fw={600} c="brand.7" onClick={() => vm.openView(invoice)}>
          <Mono>{invoice.invoiceNumber}</Mono>
        </Anchor>
      ),
    },
    { id: 'customer', header: 'Customer', cell: (invoice) => localizedJoinedName(invoice.customerName, invoice.customerNameAr, language) ?? invoice.customerId },
    { id: 'trip', header: 'Trip', cell: (invoice) => (invoice.tripTransactionNumber ? <Mono>{invoice.tripTransactionNumber}</Mono> : null) },
    { id: 'due', header: 'Due', sortKey: 'dueDate', cell: (invoice) => <Mono>{formatDate(invoice.dueDate)}</Mono> },
    { id: 'total', header: 'Total', sortKey: 'total', align: 'right', cell: (invoice) => <Mono>{invoice.total} {invoice.currency}</Mono> },
    { id: 'status', header: 'Status', sortKey: 'status', cell: (invoice) => <StatusBadge status={invoice.status} /> },
    { id: 'zatca', header: 'ZATCA', cell: (invoice) => <StatusBadge status={invoice.zatcaStatus ?? 'PENDING_SIGN'} /> },
  ];

  const confirmDanger = useConfirmDanger();

  return (
    <>
      <PageHeader title="Invoices" description="Bill customers for completed work, track payment, and issue the ZATCA QR code." />
      <Stack gap="md">
        <ListToolbar
          controls={controls}
          searchPlaceholder="Invoice # or customer"
          filters={FILTERS}
          actions={<ActionMenu layout="button" primary={actions.add('Invoice', vm.openCreate, { hidden: !vm.allowed.add })} />}
        />

        <DataTable
          columns={columns}
          rows={vm.rows}
          rowKey={(invoice) => invoice.id}
          loading={vm.loading}
          fetching={vm.fetching}
          error={vm.listError}
          emptyLabel={controls.hasCriteria ? 'No matching records.' : 'No invoices yet.'}
          sort={controls.sort}
          onSortChange={controls.setSort}
          pagination={vm.pagination}
          onPageChange={controls.setPage}
          onPageSizeChange={controls.setPageSize}
          actions={(invoice) => {
            const busy = vm.busyId === invoice.id;
            return (
              <ActionMenu
                primary={actions.view(() => vm.openView(invoice))}
                items={[
                  actions.markPaid(() => void vm.markRowPaid(invoice), { hidden: !vm.allowed.edit || invoice.status === 'PAID', loading: busy }),
                  actions.submitToZatca(() => void vm.submitRowToZatca(invoice), { hidden: !vm.allowed.edit || !canSubmitToZatca(invoice), disabled: busy }),
                  actions.delete(() => confirmDanger({ title: `${t('Delete invoice')} ${invoice.invoiceNumber}?`, onConfirm: () => void vm.remove(invoice) }), {
                    hidden: !vm.allowed.delete,
                    disabled: busy,
                  }),
                ]}
              />
            );
          }}
        />
      </Stack>
      <NewInvoiceModal vm={vm} />
      <InvoiceModal vm={vm} />
    </>
  );
}

export function InvoicesScreen() {
  return (
    <AppShell title="Invoices">
      <InvoicesBody />
    </AppShell>
  );
}
