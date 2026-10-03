'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { queryKeys } from '../../lib/api/query-keys';
import { NewWorkOrderPart, workOrderPartsApi, workOrdersApi } from '../../lib/api/workshop.api';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { useAuth } from '../auth/session-provider';
import { useResourceDetail, useResourceList } from '../crud/crud.queries';
import { MOVEMENT_KEYS } from '../inventory/use-inventory-view-model';
import { useStockPicker } from '../inventory/use-stock-picker';

/** A work order has at most a handful of lines; the largest page holds them all. */
const LINES = 100;

/**
 * Inventory used on one work order: its lines, and adding one from a
 * chosen warehouse. The server values the line at the item's unit cost,
 * takes it from that warehouse (refusing if it holds too few) and adds
 * the amount to the order's parts cost; removing a line reverses all of
 * that. Workshop permissions apply, as for the work order itself.
 */
export function useWorkOrderParts(workOrderId: number) {
  const t = useT();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const allowed = { add: can('workshop', 'add'), remove: can('workshop', 'delete') };

  const order = useResourceDetail(workOrdersApi, workOrderId);
  const lines = useResourceList(workOrderPartsApi, { pageSize: LINES, filters: { workOrderId: String(workOrderId) } });

  const picker = useStockPicker();
  const [quantity, setQuantity] = useState('1');
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Stock, the ledger and the order's costs all changed.
    for (const resource of [...MOVEMENT_KEYS, workOrdersApi.key]) void queryClient.invalidateQueries({ queryKey: queryKeys.resource(resource) });
  }, [queryClient]);

  const add = useMutation({
    mutationFn: ({ values, idempotencyKey }: { values: NewWorkOrderPart; idempotencyKey: string }) => workOrderPartsApi.create(values, idempotencyKey),
    onSuccess: () => {
      picker.reset();
      setQuantity('1');
      setKey(newIdempotencyKey());
      refresh();
    },
    onError: (failure) => setError(errorMessage(failure, 'Unable to add the item to this work order.')),
  });

  const submit = useCallback(() => {
    if (add.isPending) return;
    const count = /^\d+$/.test(quantity.trim()) ? Number(quantity) : NaN;
    if (!picker.warehouseId || !picker.itemId) return setError('Choose a warehouse and an item.');
    if (!Number.isInteger(count) || count < 1) return setError('Quantity must be a whole number of at least 1.');
    if (picker.available !== null && count > picker.available) return setError('Not enough stock of this item in the selected warehouse.');
    setError(null);
    add.mutate({ values: { workOrderId, warehouseId: Number(picker.warehouseId), itemId: Number(picker.itemId), quantity: count }, idempotencyKey: key });
  }, [add, picker, quantity, workOrderId, key]);

  const removeLine = useMutation({
    mutationFn: (id: number) => workOrderPartsApi.remove(id),
    onSuccess: refresh,
    onError: (failure) => notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(failure, 'Delete failed.')) }),
  });

  return {
    allowed,
    order: order.data,
    lines: { rows: lines.data?.items, loading: lines.isPending, fetching: lines.isFetching && !lines.isPending, error: lines.isError ? errorMessage(lines.error, 'Failed to load data.') : null },
    picker,
    quantity,
    setQuantity,
    error,
    saving: add.isPending,
    submit,
    remove: (id: number) => removeLine.mutate(id),
    removingId: removeLine.isPending ? removeLine.variables : null,
  };
}
