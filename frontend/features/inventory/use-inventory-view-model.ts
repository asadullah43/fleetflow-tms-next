'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { inventoryMovementsApi, inventoryStockApi, STOCK_KEYS, StockIn, StockOut } from '../../lib/api/inventory.api';
import { queryKeys } from '../../lib/api/query-keys';
import type { ListQuery } from '../../lib/api/types';
import { today } from '../../lib/date';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { usePagedList } from '../crud/use-paged-list';
import { useStockPicker } from './use-stock-picker';

export type InventoryTab = 'stock' | 'in' | 'out';

/** One type of movement, under its own cache key (the IN and OUT lists must never share an entry). */
const movementsOf = (type: 'IN' | 'OUT') => ({
  key: `${inventoryMovementsApi.key}.${type.toLowerCase()}`,
  list: (query: ListQuery = {}) => inventoryMovementsApi.list({ ...query, filters: { ...query.filters, type } }),
});
const IN_MOVES = movementsOf('IN');
const OUT_MOVES = movementsOf('OUT');

/** Every cached query a movement can change. */
export const MOVEMENT_KEYS = [...STOCK_KEYS, IN_MOVES.key, OUT_MOVES.key, 'dashboard'];

const emptyIn = () => ({ mode: 'existing' as 'existing' | 'new', itemId: '', warehouseId: '', quantity: '', remarks: '', movementDate: today(), name: '', nameAr: '', itemNumber: '', category: '', minimumStock: '0', unitCost: '' });
type InForm = ReturnType<typeof emptyIn>;

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : NaN);

/**
 * The Inventory page: stock levels per warehouse, Stock in (receiving —
 * also how a new item first enters the system) and Stock out (with
 * remarks; refused by the server when the warehouse holds too few).
 */
export function useInventoryViewModel() {
  const t = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InventoryTab>('stock');

  // The stock list keeps the page's own scope, so dashboard drill-downs to /inventory land on it with their filters.
  const stock = usePagedList(inventoryStockApi, { errorFallback: 'Failed to load stock levels.', enabled: tab === 'stock' });
  const ins = usePagedList(IN_MOVES, { errorFallback: 'Failed to load stock movements.', scope: 'inventory:in', enabled: tab === 'in' });
  const outs = usePagedList(OUT_MOVES, { errorFallback: 'Failed to load stock movements.', scope: 'inventory:out', enabled: tab === 'out' });

  const refresh = useCallback(() => {
    for (const key of MOVEMENT_KEYS) void queryClient.invalidateQueries({ queryKey: queryKeys.resource(key) });
  }, [queryClient]);

  // ── Stock in ──
  const [inForm, setInForm] = useState<InForm>(emptyIn);
  const [inKey, setInKey] = useState(newIdempotencyKey);
  const [inError, setInError] = useState<string | null>(null);
  const setInField = useCallback((name: keyof InForm, value: string) => setInForm((current) => ({ ...current, [name]: value })), []);

  const receive = useMutation({
    mutationFn: ({ values, key }: { values: StockIn; key: string }) => inventoryMovementsApi.stockIn(values, key),
    onSuccess: () => {
      // Keep the warehouse and date: receiving several items into one warehouse on one day is the usual case.
      setInForm((current) => ({ ...emptyIn(), mode: current.mode, warehouseId: current.warehouseId, movementDate: current.movementDate }));
      setInKey(newIdempotencyKey());
      refresh();
      notifications.show({ color: 'teal', message: t('Stock received.') });
    },
    onError: (error) => setInError(errorMessage(error, 'Unable to receive stock.')),
  });

  const submitIn = useCallback(() => {
    if (receive.isPending) return;
    const quantity = wholeNumber(inForm.quantity);
    const minimumStock = wholeNumber(inForm.minimumStock || '0');
    if (!inForm.warehouseId) return setInError('Choose a warehouse.');
    if (inForm.mode === 'existing' && !inForm.itemId) return setInError('Choose an item, or switch to New item.');
    if (inForm.mode === 'new' && !inForm.name.trim()) return setInError('Enter the new item’s name.');
    if (!Number.isInteger(quantity) || quantity < 1) return setInError('Quantity must be a whole number of at least 1.');
    if (inForm.mode === 'new' && !Number.isInteger(minimumStock)) return setInError('Minimum stock must be a whole number.');
    if (inForm.mode === 'new' && inForm.unitCost.trim() && !/^\d+(\.\d{1,2})?$/.test(inForm.unitCost.trim())) return setInError('Unit cost must be an amount like 12.50.');
    setInError(null);
    const values: StockIn = {
      warehouseId: Number(inForm.warehouseId),
      quantity,
      remarks: inForm.remarks.trim() || undefined,
      movementDate: inForm.movementDate || undefined,
      ...(inForm.mode === 'existing'
        ? { itemId: Number(inForm.itemId) }
        : { newItem: { name: inForm.name.trim(), nameAr: inForm.nameAr.trim() || undefined, itemNumber: inForm.itemNumber.trim() || undefined, category: inForm.category.trim() || undefined, minimumStock, unitCost: inForm.unitCost.trim() || undefined } }),
    };
    receive.mutate({ values, key: inKey });
  }, [receive, inForm, inKey]);

  // ── Stock out ──
  const picker = useStockPicker();
  const [outQuantity, setOutQuantity] = useState('');
  const [outRemarks, setOutRemarks] = useState('');
  const [outDate, setOutDate] = useState(today);
  const [outKey, setOutKey] = useState(newIdempotencyKey);
  const [outError, setOutError] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: ({ values, key }: { values: StockOut; key: string }) => inventoryMovementsApi.stockOut(values, key),
    onSuccess: () => {
      picker.reset();
      setOutQuantity('');
      setOutRemarks('');
      setOutKey(newIdempotencyKey());
      refresh();
      notifications.show({ color: 'teal', message: t('Stock removed.') });
    },
    onError: (error) => setOutError(errorMessage(error, 'Unable to remove stock.')),
  });

  const submitOut = useCallback(() => {
    if (issue.isPending) return;
    const quantity = wholeNumber(outQuantity);
    if (!picker.warehouseId || !picker.itemId) return setOutError('Choose a warehouse and an item.');
    if (!Number.isInteger(quantity) || quantity < 1) return setOutError('Quantity must be a whole number of at least 1.');
    // The server decides (and refuses atomically); this only saves a round trip for the obvious case.
    if (picker.available !== null && quantity > picker.available) return setOutError('Not enough stock of this item in the selected warehouse.');
    setOutError(null);
    issue.mutate({ values: { warehouseId: Number(picker.warehouseId), itemId: Number(picker.itemId), quantity, remarks: outRemarks.trim() || undefined, movementDate: outDate || undefined }, key: outKey });
  }, [issue, picker, outQuantity, outRemarks, outDate, outKey]);

  return {
    tab,
    setTab,
    allowed: stock.allowed,
    stock,
    ins,
    outs,
    stockIn: { form: inForm, setField: setInField, error: inError, saving: receive.isPending, submit: submitIn },
    stockOut: { picker, quantity: outQuantity, setQuantity: setOutQuantity, remarks: outRemarks, setRemarks: setOutRemarks, movementDate: outDate, setMovementDate: setOutDate, error: outError, saving: issue.isPending, submit: submitOut },
  };
}

export type InventoryViewModel = ReturnType<typeof useInventoryViewModel>;
