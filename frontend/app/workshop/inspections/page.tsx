'use client';

import { useMemo } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { PageLoading } from '../../../components/PageLoading';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { useLookups } from '../../../lib/use-lookups';
import { vehicleInspectionsClient, VehicleInspectionDto } from '../../../lib/grpc/workshop';
import { trucksClient } from '../../../lib/grpc/trucks';

type Opt = { value: string; label: string }[];

const RESULTS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
];

export default function InspectionsPage() {
  const { token } = useAuth();
  const { data: opts, error: lookupError } = useLookups<{ trucks: Opt }>(async (token) => {
    const trucks = await trucksClient.list(token);
    return { trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })) };
  }, []);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'truck', label: 'Truck', options: opts?.trucks.map((o) => o.label) ?? [] },
        { name: 'result', label: 'Result', options: RESULTS.map((r) => r.label) },
      ],
      apply: (r: VehicleInspectionDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const resultLabel = RESULTS.find((x) => x.value === r.result)?.label ?? r.result;
        return match(r.truckNumber, f.truck) && match(resultLabel, f.result);
      },
    }),
    [opts],
  );

  if (!opts) return <PageLoading title="Inspections" error={lookupError} />;

  return (
    <CrudPage<VehicleInspectionDto>
      title="Inspections"
      description="Pass/fail vehicle inspection records per truck."
      addLabel="Inspection"
      emptyLabel="No inspections recorded yet."
      filterBar={filterBar}
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
        { name: 'inspectDate', label: 'Inspection date', type: 'date', required: true },
        { name: 'result', label: 'Result', type: 'select', options: RESULTS },
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
  );
}
