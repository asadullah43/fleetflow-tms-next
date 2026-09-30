'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { supplierPaymentsClient, SupplierPaymentDto } from '../../lib/grpc/supplier-payments';
import { suppliersClient } from '../../lib/grpc/suppliers';

export default function SupplierPaymentsPage() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<{ value: string; label: string }[] | null>(null);

  useEffect(() => {
    if (!token) return;
    suppliersClient.list(token).then((rows) => setSuppliers(rows.map((s) => ({ value: String(s.id), label: s.name }))));
  }, [token]);

  if (!suppliers) {
    return (
      <AppShell title="Supplier Payments">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  function toApi(values: Record<string, string>) {
    return { supplierId: Number(values.supplierId), amount: values.amount, currency: values.currency || 'SAR', paymentDate: values.paymentDate, description: values.description };
  }

  return (
    <CrudPage<SupplierPaymentDto>
      title="Supplier Payments"
      addLabel="Payment"
      emptyLabel="No supplier payments recorded yet."
      columns={[
        { header: 'Supplier', render: (r) => r.supplierName ?? r.supplierId },
        { header: 'Amount', render: (r) => `${r.amount} ${r.currency}`, align: 'right' },
        { header: 'Date', render: (r) => r.paymentDate?.slice(0, 10) },
        { header: 'Description', render: (r) => r.description ?? '—' },
      ]}
      fetchAll={() => supplierPaymentsClient.list(token!)}
      onCreate={(values) => supplierPaymentsClient.create(toApi(values), token!)}
      onUpdate={(id, values) => supplierPaymentsClient.update(id, toApi(values), token!)}
      onDelete={(id) => supplierPaymentsClient.remove(id, token!)}
      formFields={[
        { name: 'supplierId', label: 'Supplier', type: 'select', options: suppliers, required: true },
        { name: 'amount', label: 'Amount', required: true },
        { name: 'currency', label: 'Currency' },
        { name: 'paymentDate', label: 'Payment date', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      emptyValues={{ supplierId: '', amount: '', currency: 'SAR', paymentDate: '', description: '' }}
      toFormValues={(r) => ({
        supplierId: String(r.supplierId),
        amount: r.amount,
        currency: r.currency,
        paymentDate: r.paymentDate?.slice(0, 10) ?? '',
        description: r.description ?? '',
      })}
    />
  );
}
