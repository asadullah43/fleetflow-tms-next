'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { useAuth } from '../../../lib/auth-context';
import { workshopExpensesClient, WorkshopExpenseDto } from '../../../lib/grpc/workshop';
import { trucksClient } from '../../../lib/grpc/trucks';

type Opt = { value: string; label: string }[];

export default function WorkshopExpensesPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ trucks: Opt } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    Promise.all([trucksClient.list(token), workshopExpensesClient.list(token)]).then(([trucks, expenses]) => {
      setOpts({ trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })) });
      setCategories(Array.from(new Set(expenses.map((e) => e.category).filter(Boolean))).sort());
    });
  }, [token]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'truck', label: 'Truck', options: opts?.trucks.map((o) => o.label) ?? [] },
        { name: 'category', label: 'Category', options: categories },
      ],
      apply: (r: WorkshopExpenseDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        return match(r.truckNumber, f.truck) && match(r.category, f.category);
      },
    }),
    [opts, categories],
  );

  if (!opts) {
    return (
      <AppShell title="Expenses">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<WorkshopExpenseDto>
      title="Expenses"
      description="Workshop spend per truck — parts, labor, and other repair costs."
      addLabel="Expense"
      emptyLabel="No workshop expenses recorded yet."
      filterBar={filterBar}
      columns={[
        { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
        { header: 'Category', render: (r) => r.category },
        { header: 'Amount', render: (r) => r.amount, align: 'right' },
        { header: 'Date', render: (r) => r.expenseDate?.slice(0, 10) },
      ]}
      fetchAll={() => workshopExpensesClient.list(token!)}
      onCreate={(v) => workshopExpensesClient.create({ ...v, truckId: Number(v.truckId) }, token!)}
      onUpdate={(id, v) => workshopExpensesClient.update(id, { ...v, truckId: Number(v.truckId) }, token!)}
      onDelete={(id) => workshopExpensesClient.remove(id, token!)}
      formFields={[
        { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
        { name: 'category', label: 'Category', required: true },
        { name: 'amount', label: 'Amount', required: true },
        { name: 'expenseDate', label: 'Expense date', type: 'date' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      emptyValues={{ truckId: '', category: '', amount: '', expenseDate: '', description: '' }}
      toFormValues={(r) => ({
        truckId: String(r.truckId),
        category: r.category,
        amount: r.amount,
        expenseDate: r.expenseDate?.slice(0, 10) ?? '',
        description: r.description ?? '',
      })}
    />
  );
}
