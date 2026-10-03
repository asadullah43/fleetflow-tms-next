'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceDto, invoicesApi } from '../../lib/api/invoices.api';
import { queryKeys } from '../../lib/api/query-keys';
import { tripsApi } from '../../lib/api/trips.api';

/** Invoice writes. Each refreshes the invoice lists and the dashboard's unpaid figures; those that can link or unlink a trip also the trips (which show their invoice). */
export function useInvoiceMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource(invoicesApi.key) });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const onTripLinkChange = () => {
    onSuccess();
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource(tripsApi.key) });
  };
  return {
    create: useMutation({
      mutationFn: ({ values, idempotencyKey }: { values: Record<string, unknown>; idempotencyKey: string }) => invoicesApi.create(values, idempotencyKey),
      onSuccess: onTripLinkChange,
    }),
    update: useMutation<InvoiceDto, unknown, { id: number; values: Record<string, unknown> }>({ mutationFn: ({ id, values }) => invoicesApi.update(id, values), onSuccess: onTripLinkChange }),
    remove: useMutation({ mutationFn: (id: number) => invoicesApi.remove(id), onSuccess: onTripLinkChange }),
    markPaid: useMutation<InvoiceDto, unknown, number>({ mutationFn: (id) => invoicesApi.markPaid(id), onSuccess }),
    submitToZatca: useMutation<InvoiceDto, unknown, number>({ mutationFn: (id) => invoicesApi.submitToZatca(id), onSuccess }),
  };
}
