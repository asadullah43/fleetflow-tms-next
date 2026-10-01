'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { trucksClient, TruckDto } from '../../lib/grpc/trucks';

export default function TrucksPage() {
  const { token } = useAuth();

  return (
    <CrudPage<TruckDto>
      title="Trucks"
      description="Manage your fleet vehicles, maintenance schedules, and truck assignments."
      addLabel="Truck"
      searchPlaceholder="Truck number"
      emptyLabel="No trucks yet — add your first vehicle to start scheduling trips."
      columns={[
        { header: 'Truck number', render: (r) => <span className="mono">{r.truckNumber}</span> },
        { header: 'Type', render: (r) => r.truckType ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => trucksClient.list(token!)}
      onCreate={(values) => trucksClient.create(values, token!)}
      onUpdate={(id, values) => trucksClient.update(id, values, token!)}
      onDelete={(id) => trucksClient.remove(id, token!)}
      formFields={[
        { name: 'truckNumber', label: 'Truck number', required: true },
        { name: 'truckType', label: 'Truck type' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'MAINTENANCE', label: 'Maintenance' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        },
      ]}
      emptyValues={{ truckNumber: '', truckType: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({ truckNumber: r.truckNumber, truckType: r.truckType ?? '', status: r.status })}
    />
  );
}
