'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CrudPanel } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import {
  workOrdersClient,
  maintenanceSchedulesClient,
  vehicleInspectionsClient,
  sparePartsClient,
  workshopExpensesClient,
  WorkOrderDto,
  MaintenanceScheduleDto,
  VehicleInspectionDto,
  SparePartDto,
  WorkshopExpenseDto,
} from '../../lib/grpc/workshop';
import { trucksClient } from '../../lib/grpc/trucks';
import { driversClient } from '../../lib/grpc/drivers';
import { suppliersClient } from '../../lib/grpc/suppliers';

type Opt = { value: string; label: string }[];
const TABS = ['Work Orders', 'Maintenance Schedules', 'Inspections', 'Spare Parts', 'Expenses'] as const;

function Tabs({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: active === t ? '2px solid var(--accent)' : '2px solid transparent',
            borderRadius: 0,
            color: active === t ? 'var(--text)' : 'var(--text-muted)',
            padding: '8px 4px',
            marginRight: 20,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export default function WorkshopPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Work Orders');
  const [opts, setOpts] = useState<{ trucks: Opt; drivers: Opt; suppliers: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([trucksClient.list(token), driversClient.list(token), suppliersClient.list(token)]).then(([trucks, drivers, suppliers]) => {
      setOpts({
        trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })),
        drivers: drivers.map((d) => ({ value: String(d.id), label: d.name })),
        suppliers: suppliers.map((s) => ({ value: String(s.id), label: s.name })),
      });
    });
  }, [token]);

  return (
    <AppShell title="Workshop">
      <Tabs active={tab} onChange={(t) => setTab(t as (typeof TABS)[number])} />

      {tab === 'Work Orders' && opts && (
        <CrudPanel<WorkOrderDto>
          addLabel="Work Order"
          emptyLabel="No work orders yet."
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
            { name: 'priority', label: 'Priority', type: 'select', options: [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }] },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }] },
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
      )}

      {tab === 'Maintenance Schedules' && opts && (
        <CrudPanel<MaintenanceScheduleDto>
          addLabel="Maintenance Schedule"
          emptyLabel="No maintenance schedules yet."
          columns={[
            { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
            { header: 'Type', render: (r) => r.maintenanceType },
            { header: 'Next service', render: (r) => (r.nextService ? r.nextService.slice(0, 10) : '—') },
            { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          fetchAll={() => maintenanceSchedulesClient.list(token!)}
          onCreate={(v) => maintenanceSchedulesClient.create({ ...v, truckId: Number(v.truckId) }, token!)}
          onUpdate={(id, v) => maintenanceSchedulesClient.update(id, { ...v, truckId: Number(v.truckId) }, token!)}
          onDelete={(id) => maintenanceSchedulesClient.remove(id, token!)}
          formFields={[
            { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
            { name: 'maintenanceType', label: 'Maintenance type', required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
            { name: 'lastService', label: 'Last service date' },
            { name: 'nextService', label: 'Next service date' },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'DONE', label: 'Done' }, { value: 'OVERDUE', label: 'Overdue' }] },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyValues={{ truckId: '', maintenanceType: '', description: '', lastService: '', nextService: '', status: 'ACTIVE', notes: '' }}
          toFormValues={(r) => ({
            truckId: String(r.truckId),
            maintenanceType: r.maintenanceType,
            description: r.description ?? '',
            lastService: r.lastService?.slice(0, 10) ?? '',
            nextService: r.nextService?.slice(0, 10) ?? '',
            status: r.status,
            notes: r.notes ?? '',
          })}
        />
      )}

      {tab === 'Inspections' && opts && (
        <CrudPanel<VehicleInspectionDto>
          addLabel="Inspection"
          emptyLabel="No inspections recorded yet."
          columns={[
            { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
            { header: 'Date', render: (r) => r.inspectDate?.slice(0, 10) },
            { header: 'Result', render: (r) => <StatusBadge status={r.result} /> },
          ]}
          fetchAll={() => vehicleInspectionsClient.list(token!)}
          onCreate={(v) => vehicleInspectionsClient.create({ ...v, truckId: Number(v.truckId), inspectorId: Number(v.inspectorId) }, token!)}
          onUpdate={(id, v) => vehicleInspectionsClient.update(id, { ...v, truckId: Number(v.truckId), inspectorId: Number(v.inspectorId) }, token!)}
          onDelete={(id) => vehicleInspectionsClient.remove(id, token!)}
          formFields={[
            { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
            { name: 'inspectorId', label: 'Inspector (user ID)', required: true },
            { name: 'inspectDate', label: 'Inspection date', required: true },
            { name: 'result', label: 'Result', type: 'select', options: [{ value: 'PASS', label: 'Pass' }, { value: 'FAIL', label: 'Fail' }] },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyValues={{ truckId: '', inspectorId: '', inspectDate: '', result: 'PASS', notes: '' }}
          toFormValues={(r) => ({
            truckId: String(r.truckId),
            inspectorId: String(r.inspectorId),
            inspectDate: r.inspectDate?.slice(0, 10) ?? '',
            result: r.result,
            notes: r.notes ?? '',
          })}
        />
      )}

      {tab === 'Spare Parts' && opts && (
        <CrudPanel<SparePartDto>
          addLabel="Spare Part"
          emptyLabel="No spare parts in inventory yet."
          columns={[
            { header: 'Name', render: (r) => r.name },
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
            { name: 'name', label: 'Name', required: true },
            { name: 'language', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }] },
            { name: 'partNumber', label: 'Part number' },
            { name: 'category', label: 'Category' },
            { name: 'quantity', label: 'Quantity in stock', required: true },
            { name: 'minimumStock', label: 'Minimum stock level', required: true },
            { name: 'unitCost', label: 'Unit cost' },
            { name: 'supplierId', label: 'Supplier', type: 'select', options: opts.suppliers },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'DISCONTINUED', label: 'Discontinued' }] },
          ]}
          emptyValues={{ name: '', language: 'en', partNumber: '', category: '', quantity: '0', minimumStock: '0', unitCost: '0', supplierId: '', status: 'ACTIVE' }}
          toFormValues={(r) => ({
            name: r.name,
            language: 'en',
            partNumber: r.partNumber ?? '',
            category: r.category ?? '',
            quantity: String(r.quantity),
            minimumStock: String(r.minimumStock),
            unitCost: r.unitCost,
            supplierId: r.supplierId ? String(r.supplierId) : '',
            status: r.status,
          })}
        />
      )}

      {tab === 'Expenses' && opts && (
        <CrudPanel<WorkshopExpenseDto>
          addLabel="Expense"
          emptyLabel="No workshop expenses recorded yet."
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
            { name: 'expenseDate', label: 'Expense date' },
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
      )}
    </AppShell>
  );
}
