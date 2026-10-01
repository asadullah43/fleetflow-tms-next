'use client';

import { useState } from 'react';
import { Center, Loader, Modal } from '@mantine/core';
import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { assignmentsApi, AssignmentDto } from '../../lib/api/assignments.api';
import { formatDate } from '../../lib/date';
import { useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { useTruckAssignments } from './assignment.queries';
import { AssignmentTimeline } from './AssignmentTimeline';

const definition: CrudDefinition<AssignmentDto> = {
  api: assignmentsApi,
  title: 'Truck-Driver Assignments',
  description: 'Manage which driver is assigned to which truck, and for how long.',
  addLabel: 'Assignment',
  searchPlaceholder: 'Truck or driver',
  emptyLabel: 'No assignments yet — assign a driver to a truck to start tracking runs.',
  columns: [
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono', sortKey: 'truckNumber' },
    { header: 'Driver', value: (r, { language }) => localizedJoinedName(r.driverName, r.driverNameAr, language), sortKey: 'driverName' },
    { header: 'Start', value: (r) => formatDate(r.startDate), kind: 'mono', sortKey: 'startDate' },
    { header: 'End', value: (r, { t }) => (r.endDate ? formatDate(r.endDate) : t('Ongoing')), kind: 'mono', sortKey: 'endDate' },
  ],
  filters: [
    { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks },
    { name: 'driverId', label: 'Driver', type: 'lookup', lookup: lookups.drivers },
    { name: 'activeOn', label: 'Active on', type: 'date' },
  ],
  fields: [
    { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks, required: true },
    { name: 'driverId', label: 'Driver', type: 'lookup', lookup: lookups.drivers, required: true },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date (leave blank if ongoing)', type: 'date' },
  ],
  // On edit, a blank end date is sent as '' — the backend reads that as "make it ongoing again".
  toApi: (payload, values, mode) => (mode === 'create' && !values.endDate ? { ...payload, endDate: undefined } : payload),
};

function HistoryModal({ row, onClose }: { row: AssignmentDto | null; onClose: () => void }) {
  const t = useT();
  const history = useTruckAssignments(row?.truckId ?? null);
  return (
    <Modal opened={row !== null} onClose={onClose} title={`${t('Assignment history')} — ${row?.truckNumber ?? ''}`}>
      {history.isPending ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : (
        <AssignmentTimeline history={history.data ?? []} />
      )}
    </Modal>
  );
}

export function AssignmentsScreen() {
  const [viewing, setViewing] = useState<AssignmentDto | null>(null);
  return (
    <>
      <CrudScreen definition={definition} rowActions={[{ label: 'View history', icon: 'eye', onClick: setViewing }]} />
      <HistoryModal row={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
