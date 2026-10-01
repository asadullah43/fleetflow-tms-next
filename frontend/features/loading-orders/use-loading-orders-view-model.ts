'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { LoadingOrderBatchDto, loadingOrdersApi, NewLoadingOrders } from '../../lib/api/loading-orders.api';
import { queryKeys } from '../../lib/api/query-keys';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useLanguage, useT } from '../../lib/language-context';
import { usePagePermissions } from '../auth/session-provider';
import { useListControls } from '../crud/use-list-controls';
import { buildLoadingOrderPdf } from './loading-order-pdf';

export const MAX_QUANTITY = 200;

const emptyForm = () => ({ pickupLocationId: '', deliveryLocationId: '', customerId: '', cargoTypeId: '', quantity: '1' });
type Form = ReturnType<typeof emptyForm>;

/**
 * "Generate" creates N individually-serialled slips sharing one batch and
 * opens them as a PDF. The list shows one row per batch; a batch can be
 * re-opened as a PDF or deleted as a whole.
 */
export function useLoadingOrdersViewModel() {
  const t = useT();
  const { language } = useLanguage();
  const allowed = usePagePermissions();
  const queryClient = useQueryClient();
  const controls = useListControls();

  const list = useQuery({
    queryKey: queryKeys.list(loadingOrdersApi.key, controls.query),
    queryFn: () => loadingOrdersApi.listGrouped(controls.query),
    placeholderData: keepPreviousData,
    enabled: allowed.view,
  });

  const [form, setForm] = useState<Form>(emptyForm);
  // One key per filled-in form: pressing Generate twice cannot issue two runs of serial numbers.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [formError, setFormError] = useState<string | null>(null);
  const [openingBatchId, setOpeningBatchId] = useState<number | null>(null);

  const setField = useCallback((name: keyof Form, value: string) => setForm((current) => ({ ...current, [name]: value })), []);

  /**
   * Fetches the batch's document from the backend and shows it as a PDF.
   * `tab` was opened synchronously in the click handler: a tab opened
   * later, after the awaits, would be stopped by pop-up blockers.
   */
  const showPdf = useCallback(
    async (batchId: number, tab: Window | null) => {
      try {
        const documentData = await queryClient.fetchQuery({ queryKey: queryKeys.loadingOrderDocument(batchId), queryFn: () => loadingOrdersApi.getBatchDocument(batchId), staleTime: 0 });
        const pdf = await buildLoadingOrderPdf(documentData, language);
        if (!pdf) throw new Error('empty');
        const url = URL.createObjectURL(pdf.blob);
        if (tab && !tab.closed) tab.location.href = url;
        else {
          // No tab (blocked): download the file instead.
          const link = document.createElement('a');
          link.href = url;
          link.download = `${pdf.title}.pdf`;
          link.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) {
        tab?.close();
        throw error;
      }
    },
    [queryClient, language],
  );

  const generate = useMutation({
    mutationFn: ({ values, key }: { values: NewLoadingOrders; key: string; tab: Window | null }) => loadingOrdersApi.create(values, key),
    onSuccess: async (orders, { tab }) => {
      setForm(emptyForm());
      setIdempotencyKey(newIdempotencyKey());
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource(loadingOrdersApi.key) });
      try {
        if (orders[0]) await showPdf(orders[0].batchId, tab);
      } catch (error) {
        notifications.show({ color: 'yellow', title: t('Loading orders created'), message: t(errorMessage(error, 'The PDF could not be opened. Use the PDF button in the list below.')) });
      }
    },
    onError: (error, { tab }) => {
      tab?.close();
      setFormError(errorMessage(error, 'Unable to generate loading orders.'));
    },
  });

  const { mutate: runGenerate, isPending: generating } = generate;
  const submit = useCallback(() => {
    if (generating) return;
    const quantity = Number(form.quantity);
    if (!form.pickupLocationId || !form.deliveryLocationId || !form.customerId || !form.cargoTypeId) {
      setFormError('Pickup, delivery, customer, and cargo type are all required.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      setFormError('Quantity must be a whole number between 1 and 200.');
      return;
    }
    setFormError(null);
    runGenerate({
      values: { pickupLocationId: Number(form.pickupLocationId), deliveryLocationId: Number(form.deliveryLocationId), customerId: Number(form.customerId), cargoTypeId: Number(form.cargoTypeId), quantity },
      key: idempotencyKey,
      tab: window.open('', '_blank'),
    });
  }, [generating, form, idempotencyKey, runGenerate]);

  const openPdf = useCallback(
    async (batch: LoadingOrderBatchDto) => {
      const tab = window.open('', '_blank');
      setOpeningBatchId(batch.batchId);
      try {
        await showPdf(batch.batchId, tab);
      } catch (error) {
        notifications.show({ color: 'red', message: t(errorMessage(error, 'Unable to open this batch as a PDF.')) });
      } finally {
        setOpeningBatchId(null);
      }
    },
    [showPdf, t],
  );

  const removeBatch = useMutation({
    mutationFn: (batchId: number) => loadingOrdersApi.removeBatch(batchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource(loadingOrdersApi.key) });
      notifications.show({ color: 'teal', message: t('Record deleted.') });
    },
    onError: (error) => notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(error, 'Delete failed.')) }),
  });

  return {
    allowed,
    controls,
    rows: list.data?.items,
    pagination: list.data?.pagination,
    loading: list.isPending && allowed.view,
    fetching: list.isFetching && !list.isPending,
    listError: list.isError ? errorMessage(list.error, 'Failed to load loading orders.') : null,
    form,
    setField,
    formError,
    generating,
    submit,
    openingBatchId,
    openPdf,
    remove: removeBatch.mutate,
  };
}
