'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { assignmentsClient, AssignmentDto } from '../../lib/grpc/assignments';
import { trucksClient } from '../../lib/grpc/trucks';
import { driversClient } from '../../lib/grpc/drivers';

export default function AssignmentsPage() {
  const { token } = useAuth();
  const [options, setOptions] = useState<{ trucks: { value: string; label: string }[]; drivers: { value: string; label: string }[] } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([trucksClient.list(token), driversClient.list(token)]).then(([trucks, drivers]) => {
      setOptions({
        trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })),
        drivers: drivers.map((d) => ({ value: String(d.id), label: d.name })),
      });
    });
  }, [token]);

  if (!options) {
    return (
      <AppShell title="Truck-Driver Assignments">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<AssignmentDto>
      title="Truck-Driver Assignments"
      addLabel="Assignment"
      emptyLabel="No assignments yet — assign a driver to a truck to start tracking runs."
      columns={[
        { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
        { header: 'Driver', render: (r) => r.driverName ?? r.driverId },
        { header: 'Start', render: (r) => r.startDate?.slice(0, 10) },
        { header: 'End', render: (r) => (r.endDate ? r.endDate.slice(0, 10) : 'Ongoing') },
      ]}
      fetchAll={() => assignmentsClient.list(token!)}
      onCreate={(values) =>
        assignmentsClient.create({ truckId: Number(values.truckId), driverId: Number(values.driverId), startDate: values.startDate, endDate: values.endDate || undefined }, token!)
      }
      onUpdate={(id, values) =>
        assignmentsClient.update(
          id,
          { truckId: Number(values.truckId), driverId: Number(values.driverId), startDate: values.startDate, endDate: values.endDate || undefined },
          token!,
        )
      }
      onDelete={(id) => assignmentsClient.remove(id, token!)}
      formFields={[
        { name: 'truckId', label: 'Truck', type: 'select', options: options.trucks, required: true },
        { name: 'driverId', label: 'Driver', type: 'select', options: options.drivers, required: true },
        { name: 'startDate', label: 'Start date', type: 'text', required: true },
        { name: 'endDate', label: 'End date (leave blank if ongoing)' },
      ]}
      emptyValues={{ truckId: '', driverId: '', startDate: '', endDate: '' }}
      toFormValues={(r) => ({
        truckId: String(r.truckId),
        driverId: String(r.driverId),
        startDate: r.startDate?.slice(0, 10) ?? '',
        endDate: r.endDate?.slice(0, 10) ?? '',
      })}
    />
  );
}
