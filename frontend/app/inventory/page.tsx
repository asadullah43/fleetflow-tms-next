'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/language-context';
import { localizedName } from '../../lib/localized-name';
import { sparePartsClient, SparePartDto } from '../../lib/grpc/workshop';
import { suppliersClient } from '../../lib/grpc/suppliers';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

/** Spare parts stock, moved out of Workshop into its own top-level module. */
export default function InventoryPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const [opts, setOpts] = useState<{ suppliers: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    suppliersClient.list(token).then((suppliers) => setOpts({ suppliers: suppliers.map((s) => ({ value: String(s.id), label: localizedName(s, language) })) }));
  }, [token, language]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'partNumber', label: 'Part #' },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: SparePartDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.name, f.name) && match(r.partNumber, f.partNumber) && match(statusLabel, f.status);
      },
    }),
    [],
  );

  if (!opts) {
    return (
      <AppShell title="Inventory">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<SparePartDto>
      title="Inventory"
      description="Spare parts stock levels, reorder thresholds, and unit cost."
      addLabel="Spare Part"
      emptyLabel="No spare parts in inventory yet."
      filterBar={filterBar}
      columns={[
        { header: 'Name', render: (r) => localizedName(r, language) },
        { header: 'Part #', render: (r) => r.partNumber ?? '—' },
        { header: 'Qty', render: (r) => r.quantity, align: 'right' },
        { header: 'Min stock', render: (r) => r.minimumStock, align: 'right' },
        { header: 'Unit cost', render: (r) => r.unitCost, align: 'right' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => sparePartsClient.list(token!)}
      onCreate={(v) => sparePartsClient.create({ ...v, quantity: Number(v.quantity), minimumStock: Number(v.minimumStock), supplierId: v.supplierId ? Number(v.supplierId) : undefined }, token!)}
      onUpdate={(id, v) => sparePartsClient.update(id, { ...v, quantity: Number(v.quantity), minimumStock: Number(v.minimumStock), supplierId: v.supplierId ? Number(v.supplierId) : undefined }, token!)}
      onDelete={(id) => sparePartsClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name (English)', required: true },
        { name: 'nameAr', label: 'Name (Arabic)' },
        { name: 'partNumber', label: 'Part number' },
        { name: 'category', label: 'Category' },
        { name: 'quantity', label: 'Quantity in stock', required: true },
        { name: 'minimumStock', label: 'Minimum stock level', required: true },
        { name: 'unitCost', label: 'Unit cost' },
        { name: 'supplierId', label: 'Supplier', type: 'select', options: opts.suppliers },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ name: '', nameAr: '', partNumber: '', category: '', quantity: '0', minimumStock: '0', unitCost: '0', supplierId: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        nameAr: r.nameAr ?? '',
        partNumber: r.partNumber ?? '',
        category: r.category ?? '',
        quantity: String(r.quantity),
        minimumStock: String(r.minimumStock),
        unitCost: r.unitCost,
        supplierId: r.supplierId ? String(r.supplierId) : '',
        status: r.status,
      })}
    />
  );
}
