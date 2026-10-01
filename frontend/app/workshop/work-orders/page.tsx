'use client';

import { useMemo } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { PageLoading } from '../../../components/PageLoading';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { useLookups } from '../../../lib/use-lookups';
import { useLanguage } from '../../../lib/language-context';
import { localizedName } from '../../../lib/localized-name';
import { workOrdersClient, WorkOrderDto } from '../../../lib/grpc/workshop';
import { trucksClient } from '../../../lib/grpc/trucks';
import { driversClient } from '../../../lib/grpc/drivers';
import { suppliersClient } from '../../../lib/grpc/suppliers';

type Opt = { value: string; label: string }[];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
const STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function WorkOrdersPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const { data: opts, error: lookupError } = useLookups<{ trucks: Opt; drivers: Opt; suppliers: Opt }>(async (token) => {
    const [trucks, drivers, suppliers] = await Promise.all([trucksClient.list(token), driversClient.list(token), suppliersClient.list(token)]);
    return {
      trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })),
      drivers: drivers.map((d) => ({ value: String(d.id), label: localizedName(d, language) })),
      suppliers: suppliers.map((s) => ({ value: String(s.id), label: localizedName(s, language) })),
    };
  }, [language]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'orderNumber', label: 'Order #' },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: WorkOrderDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.orderNumber, f.orderNumber) && match(statusLabel, f.status);
      },
    }),
    [],
  );

  if (!opts) return <PageLoading title="Work Orders" error={lookupError} />;

  return (
    <CrudPage<WorkOrderDto>
      title="Work Orders"
      description="Track repair and service jobs per truck, from diagnosis to completion cost."
      addLabel="Work Order"
      emptyLabel="No work orders yet."
      filterBar={filterBar}
      columns={[
        { header: 'Order #', render: (r) => <span className="mono">{r.orderNumber}</span> },
        { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
        { header: 'Issue', render: (r) => r.issue },
        { header: 'Priority', render: (r) => r.priority },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { header: 'Total cost', render: (r) => r.totalCost, align: 'right' },
      ]}
      fetchAll={() => workOrdersClient.list(token!)}
      onCreate={(v) =>
        workOrdersClient.create(
          { ...v, truckId: Number(v.truckId), driverId: v.driverId ? Number(v.driverId) : undefined, supplierId: v.supplierId ? Number(v.supplierId) : undefined },
          token!,
        )
      }
      onUpdate={(id, v) =>
        workOrdersClient.update(
          id,
          { ...v, truckId: Number(v.truckId), driverId: v.driverId ? Number(v.driverId) : undefined, supplierId: v.supplierId ? Number(v.supplierId) : undefined },
          token!,
        )
      }
      onDelete={(id) => workOrdersClient.remove(id, token!)}
      formFields={[
        { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
        { name: 'driverId', label: 'Driver', type: 'select', options: opts.drivers },
        { name: 'supplierId', label: 'Workshop / supplier', type: 'select', options: opts.suppliers },
        { name: 'issue', label: 'Issue', required: true },
        { name: 'diagnosis', label: 'Diagnosis', type: 'textarea' },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
        { name: 'laborCost', label: 'Labor cost' },
        { name: 'partsCost', label: 'Parts cost' },
        { name: 'otherCost', label: 'Other cost' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyValues={{ truckId: '', driverId: '', supplierId: '', issue: '', diagnosis: '', priority: 'MEDIUM', status: 'OPEN', laborCost: '0', partsCost: '0', otherCost: '0', notes: '' }}
      toFormValues={(r) => ({
        truckId: String(r.truckId),
        driverId: r.driverId ? String(r.driverId) : '',
        supplierId: r.supplierId ? String(r.supplierId) : '',
        issue: r.issue,
        diagnosis: r.diagnosis ?? '',
        priority: r.priority,
        status: r.status,
        laborCost: r.laborCost,
        partsCost: r.partsCost,
        otherCost: r.otherCost,
        notes: r.notes ?? '',
      })}
    />
  );
}
