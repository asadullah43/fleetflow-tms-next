'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { Modal } from '../../components/Modal';
import { AssignmentHistoryTimeline } from '../../components/AssignmentHistoryTimeline';
import { useAuth } from '../../lib/auth-context';
import { useT, useLanguage } from '../../lib/language-context';
import { localizedName } from '../../lib/localized-name';
import { assignmentsClient, AssignmentDto } from '../../lib/grpc/assignments';
import { trucksClient } from '../../lib/grpc/trucks';
import { driversClient } from '../../lib/grpc/drivers';

export default function AssignmentsPage() {
  const { token } = useAuth();
  const t = useT();
  const { language } = useLanguage();
  const [options, setOptions] = useState<{ trucks: { value: string; label: string }[]; drivers: { value: string; label: string }[] } | null>(null);
  const [history, setHistory] = useState<{ truckLabel: string; rows: AssignmentDto[] } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([trucksClient.list(token), driversClient.list(token)]).then(([trucks, drivers]) => {
      setOptions({
        trucks: trucks.map((truck) => ({ value: String(truck.id), label: truck.truckNumber })),
        drivers: drivers.map((d) => ({ value: String(d.id), label: localizedName(d, language) })),
      });
    });
  }, [token, language]);

  async function viewHistory(row: AssignmentDto) {
    if (!token) return;
    const all = await assignmentsClient.list(token);
    const rows = all.filter((a) => a.truckId === row.truckId).sort((a, b) => b.startDate.localeCompare(a.startDate));
    setHistory({ truckLabel: row.truckNumber ?? `Truck #${row.truckId}`, rows });
  }

  if (!options) {
    return (
      <AppShell title="Truck-Driver Assignments">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <>
      <CrudPage<AssignmentDto>
        title="Truck-Driver Assignments"
        description="Manage which driver is assigned to which truck, and for how long."
        addLabel="Assignment"
        searchPlaceholder="Truck or driver"
        emptyLabel="No assignments yet — assign a driver to a truck to start tracking runs."
        columns={[
          { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
          { header: 'Driver', render: (r) => r.driverName ?? r.driverId },
          { header: 'Start', render: (r) => r.startDate?.slice(0, 10) },
          { header: 'End', render: (r) => (r.endDate ? r.endDate.slice(0, 10) : 'Ongoing') },
        ]}
        fetchAll={() => assignmentsClient.list(token!)}
        onView={viewHistory}
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
          { name: 'startDate', label: 'Start date', type: 'date', required: true },
          { name: 'endDate', label: 'End date (leave blank if ongoing)', type: 'date' },
        ]}
        emptyValues={{ truckId: '', driverId: '', startDate: '', endDate: '' }}
        toFormValues={(r) => ({
          truckId: String(r.truckId),
          driverId: String(r.driverId),
          startDate: r.startDate?.slice(0, 10) ?? '',
          endDate: r.endDate?.slice(0, 10) ?? '',
        })}
      />

      {history && (
        <Modal
          title={`${t('Assignment history')} — ${history.truckLabel}`}
          onClose={() => setHistory(null)}
          footer={
            <button className="btn btn-secondary" onClick={() => setHistory(null)}>
              {t('Close')}
            </button>
          }
        >
          <AssignmentHistoryTimeline history={history.rows} subjectLabel="driver" />
        </Modal>
      )}
    </>
  );
}
