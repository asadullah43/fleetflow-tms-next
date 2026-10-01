'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { supplierPaymentsApi, SupplierPaymentDto } from '../../lib/api/supplier-payments.api';
import { formatDate } from '../../lib/date';
import { localizedJoinedName } from '../../lib/localized-name';

const definition: CrudDefinition<SupplierPaymentDto> = {
  api: supplierPaymentsApi,
  title: 'Supplier Payments',
  description: 'Record payments made to suppliers.',
  addLabel: 'Payment',
  searchPlaceholder: 'Supplier or description',
  emptyLabel: 'No supplier payments recorded yet.',
  columns: [
    { header: 'Supplier', value: (r, { language }) => localizedJoinedName(r.supplierName, r.supplierNameAr, language), sortKey: 'supplierName' },
    { header: 'Amount', value: (r) => `${r.amount} ${r.currency}`, kind: 'mono', align: 'right', sortKey: 'amount' },
    { header: 'Date', value: (r) => formatDate(r.paymentDate), kind: 'mono', sortKey: 'paymentDate' },
    { header: 'Description', value: (r) => r.description },
  ],
  filters: [
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers },
    { name: 'fromDate', label: 'From Date', type: 'date' },
    { name: 'toDate', label: 'To Date', type: 'date' },
  ],
  fields: [
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers, required: true },
    { name: 'amount', label: 'Amount', type: 'decimal', required: true },
    { name: 'currency', label: 'Currency', default: 'SAR' },
    { name: 'paymentDate', label: 'Payment date', type: 'date', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  toApi: (payload) => ({ ...payload, currency: payload.currency || 'SAR' }),
};

export function SupplierPaymentsScreen() {
  return <CrudScreen definition={definition} />;
}
