'use client';

import { useCallback, useMemo, useState } from 'react';
import { defineLookup } from '../../components/AsyncSelect';
import { inventoryItemsApi, inventoryStockApi } from '../../lib/api/inventory.api';
import { useResourceList } from '../crud/crud.queries';
import { inventoryItemLabel } from '../crud/lookups';

/**
 * Choosing stock to take out: first the warehouse, then an item that
 * warehouse actually holds, with how many it has. Used by Stock out and
 * by a work order's "inventory used" — both draw from one warehouse, so
 * the warehouse comes first and narrows the items.
 */
export function useStockPicker() {
  const [warehouseId, setWarehouseIdState] = useState('');
  const [itemId, setItemId] = useState('');

  // Another warehouse holds different items: the chosen item no longer applies.
  const setWarehouseId = useCallback((value: string) => {
    setWarehouseIdState(value);
    setItemId('');
  }, []);

  const itemLookup = useMemo(
    () => defineLookup({ api: inventoryItemsApi, label: inventoryItemLabel, filters: warehouseId ? { inWarehouse: warehouseId } : undefined }),
    [warehouseId],
  );

  // The (warehouse, item) stock row: how many can be taken. Under the inventoryStock key, so every movement refreshes it.
  const chosen = !!warehouseId && !!itemId;
  const level = useResourceList(inventoryStockApi, { pageSize: 1, filters: { warehouseId, itemId } }, chosen);
  const available = chosen && level.data ? (level.data.items[0]?.quantity ?? 0) : null;

  const reset = useCallback(() => setItemId(''), []);

  /** The chosen (warehouse, item) stock row — names and the item's unit cost — once loaded. */
  const row = chosen ? level.data?.items[0] : undefined;

  return { warehouseId, setWarehouseId, itemId, setItemId, itemLookup, available, row, reset };
}

export type StockPicker = ReturnType<typeof useStockPicker>;
