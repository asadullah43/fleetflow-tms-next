'use client';

import { useState } from 'react';
import { Alert, Button, Group, Modal, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { actions } from '../../components/action-items';
import { ActionMenu } from '../../components/ActionMenu';
import { DataTable, TableColumn } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { Mono } from '../../components/Mono';
import { useLanguage, useLocalizedDigits, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { StockPickerFields, useAvailableHint } from '../inventory/StockPickerFields';
import { useStockPicker } from '../inventory/use-stock-picker';

/** An inventory line chosen on the "add work order" form, sent with the order and taken from stock when it is saved. */
export interface StagedPart {
  itemId: number;
  warehouseId: number;
  quantity: number;
  itemName?: string;
  itemNameAr?: string;
  warehouseName?: string;
  warehouseNameAr?: string;
  /** The item's unit cost when it was picked: an estimate — the server values the line when the order is saved. */
  unitCost: string;
}

/** The form keeps the lines as a JSON string (every form value is a string). */
export function parseStagedParts(value: string): StagedPart[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** A display estimate only (as in the invoice preview): the server values each line itself when the order is saved. */
const lineCents = (line: StagedPart) => Math.round(Number(line.unitCost || 0) * 100) * line.quantity;
const money = (cents: number) => (cents / 100).toFixed(2);

/** Picks one line: warehouse → item it holds → quantity (what is already staged from that warehouse counts as taken). */
function AddLineBody({ staged, onAdd, onCancel }: { staged: StagedPart[]; onAdd: (line: StagedPart) => void; onCancel: () => void }) {
  const t = useT();
  const picker = useStockPicker();
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const alreadyStaged = staged.filter((line) => String(line.itemId) === picker.itemId && String(line.warehouseId) === picker.warehouseId).reduce((sum, line) => sum + line.quantity, 0);
  const hint = useAvailableHint(picker);

  const add = () => {
    const count = /^\d+$/.test(quantity.trim()) ? Number(quantity) : NaN;
    if (!picker.warehouseId || !picker.itemId || !picker.row) return setError('Choose a warehouse and an item.');
    if (!Number.isInteger(count) || count < 1) return setError('Quantity must be a whole number of at least 1.');
    if (picker.available !== null && count + alreadyStaged > picker.available) return setError('Not enough stock of this item in the selected warehouse.');
    const row = picker.row;
    onAdd({
      itemId: row.itemId,
      warehouseId: row.warehouseId,
      quantity: count,
      itemName: row.itemName,
      itemNameAr: row.itemNameAr,
      warehouseName: row.warehouseName,
      warehouseNameAr: row.warehouseNameAr,
      unitCost: String(row.unitCost),
    });
  };

  return (
    <Stack gap="sm">
      {error && <Alert color="red">{t(error)}</Alert>}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <StockPickerFields picker={picker} />
        <TextInput
          label={t('Quantity')}
          required
          inputMode="numeric"
          dir="ltr"
          value={quantity}
          onChange={(event) => setQuantity(event.currentTarget.value)}
          description={alreadyStaged > 0 && hint ? `${hint} · ${t('already on this order:')} ${alreadyStaged}` : hint}
        />
      </SimpleGrid>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button leftSection={<Icon.plus size={15} />} onClick={add}>
          {t('Add line')}
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * "Inventory used" on the add-work-order form: the same warehouse → item →
 * quantity choice as the Inventory used dialog of an existing order. The
 * lines are taken from stock when the order is saved, in the same
 * transaction — all of them, or (one short of stock) none and no order.
 */
export function NewWorkOrderParts({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT();
  const n = useLocalizedDigits();
  const { language } = useLanguage();
  const [adding, setAdding] = useState(false);
  const lines = parseStagedParts(value);
  const save = (next: StagedPart[]) => onChange(JSON.stringify(next));

  const columns: TableColumn<StagedPart>[] = [
    { id: 'item', header: 'Item', cell: (line) => localizedJoinedName(line.itemName, line.itemNameAr, language) },
    { id: 'warehouse', header: 'Warehouse', cell: (line) => localizedJoinedName(line.warehouseName, line.warehouseNameAr, language) },
    { id: 'qty', header: 'Qty', align: 'right', cell: (line) => <Mono fw={600}>{line.quantity}</Mono> },
    { id: 'total', header: 'Line total', align: 'right', cell: (line) => <Mono>{money(lineCents(line))}</Mono> },
  ];

  return (
    <Stack gap="xs" mt={4}>
      {lines.length > 0 && (
        <>
          <DataTable
            columns={columns}
            rows={lines}
            rowKey={(line) => lines.indexOf(line)}
            loading={false}
            emptyLabel="No inventory used on this work order yet."
            actions={(line) => <ActionMenu items={[actions.remove(() => save(lines.filter((other) => other !== line)))]} />}
          />
          <Text size="xs" c="dimmed">
            {t('Estimated parts from inventory:')} <Mono>{n(money(lines.reduce((sum, line) => sum + lineCents(line), 0)))}</Mono> — {t('added to the parts cost and taken from stock when you save.')}
          </Text>
        </>
      )}
      <Button variant="light" size="xs" leftSection={<Icon.plus size={14} />} onClick={() => setAdding(true)} style={{ alignSelf: 'flex-start' }}>
        {t('Add')}
      </Button>
      <Modal opened={adding} onClose={() => setAdding(false)} title={t('Add inventory used')} size="lg" closeOnClickOutside={false}>
        {adding && (
          <AddLineBody
            staged={lines}
            onCancel={() => setAdding(false)}
            onAdd={(line) => {
              save([...lines, line]);
              setAdding(false);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
