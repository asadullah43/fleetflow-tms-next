'use client';

import { AsyncSelect } from '../../components/AsyncSelect';
import { useLocalizedDigits, useT } from '../../lib/language-context';
import { lookups } from '../crud/lookups';
import type { StockPicker } from './use-stock-picker';

/** Warehouse, then an item stocked there (with the quantity on hand) — see useStockPicker. */
export function StockPickerFields({ picker }: { picker: StockPicker }) {
  const t = useT();
  const n = useLocalizedDigits();
  return (
    <>
      <AsyncSelect label={t('Warehouse')} required lookup={lookups.warehouses} value={picker.warehouseId} onChange={picker.setWarehouseId} />
      <AsyncSelect
        key={picker.warehouseId}
        label={t('Item')}
        required
        lookup={picker.itemLookup}
        value={picker.itemId}
        onChange={picker.setItemId}
        disabled={!picker.warehouseId}
        placeholder={picker.warehouseId ? undefined : t('Choose a warehouse first')}
        error={picker.available === 0 ? `${t('Available in this warehouse:')} ${n(0)}` : undefined}
      />
    </>
  );
}

/** "Available in this warehouse: 12", once a warehouse and item are chosen. */
export function useAvailableHint(picker: StockPicker): string | undefined {
  const t = useT();
  const n = useLocalizedDigits();
  return picker.available === null ? undefined : `${t('Available in this warehouse:')} ${n(picker.available)}`;
}
