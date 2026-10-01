'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceDto, invoicesApi } from '../../lib/api/invoices.api';
import { queryKeys } from '../../lib/api/query-keys';

/** Invoice writes. Each refreshes the invoice lists and the dashboard's unpaid figures. */
export function useInvoiceMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource(invoicesApi.key) });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  return {
    create: useMutation({ mutationFn: ({ values, idempotencyKey }: { values: Record<string, unknown>; idempotencyKey: string }) => invoicesApi.create(values, idempotencyKey), onSuccess }),
    remove: useMutation({ mutationFn: (id: number) => invoicesApi.remove(id), onSuccess }),
    markPaid: useMutation<InvoiceDto, unknown, number>({ mutationFn: (id) => invoicesApi.markPaid(id), onSuccess }),
    submitToZatca: useMutation<InvoiceDto, unknown, number>({ mutationFn: (id) => invoicesApi.submitToZatca(id), onSuccess }),
  };
}
