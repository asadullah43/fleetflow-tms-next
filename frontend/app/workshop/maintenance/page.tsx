'use client';

import { useMemo } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { PageLoading } from '../../../components/PageLoading';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { useLookups } from '../../../lib/use-lookups';
import { maintenanceSchedulesClient, MaintenanceScheduleDto } from '../../../lib/grpc/workshop';
import { trucksClient } from '../../../lib/grpc/trucks';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DONE', label: 'Done' },
  { value: 'OVERDUE', label: 'Overdue' },
];

export default function MaintenancePage() {
  const { token } = useAuth();
  const { data: opts, error: lookupError } = useLookups<{ trucks: Opt }>(async (token) => {
    const trucks = await trucksClient.list(token);
    return { trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })) };
  }, []);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'truck', label: 'Truck', options: opts?.trucks.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: MaintenanceScheduleDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.truckNumber, f.truck) && match(statusLabel, f.status);
      },
    }),
    [opts],
  );

  if (!opts) return <PageLoading title="Maintenance" error={lookupError} />;

  return (
    <CrudPage<MaintenanceScheduleDto>
      title="Maintenance"
      description="Scheduled service per truck — last and next due dates."
      addLabel="Maintenance Schedule"
      emptyLabel="No maintenance schedules yet."
      filterBar={filterBar}
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
        { name: 'lastService', label: 'Last service date', type: 'date' },
        { name: 'nextService', label: 'Next service date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
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
  );
}
