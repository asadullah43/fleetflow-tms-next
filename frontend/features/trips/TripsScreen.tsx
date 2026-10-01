'use client';

import { Loader, Text } from '@mantine/core';
import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { useCurrentAssignment } from '../assignments/assignment.queries';
import { tripsApi, TripDto } from '../../lib/api/trips.api';
import { formatDate } from '../../lib/date';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';

/** Shows who will drive: the driver assigned to the chosen truck today. The backend resolves the same assignment when the trip is saved. */
function AssignedDriver({ truckId }: { truckId: string }) {
  const t = useT();
  const { language } = useLanguage();
  const assignment = useCurrentAssignment(truckId ? Number(truckId) : null);
  if (!truckId) return <Text span c="dimmed" inherit>{t('Choose a truck first.')}</Text>;
  if (assignment.isPending) return <Loader size={14} />;
  if (!assignment.data) return <Text span c="dimmed" inherit>{t('No driver currently assigned to this truck')}</Text>;
  return <>{localizedJoinedName(assignment.data.driverName, assignment.data.driverNameAr, language)}</>;
}

const definition: CrudDefinition<TripDto> = {
  api: tripsApi,
  title: 'Trips',
  description: 'Every run a truck makes between two locations, for a customer and a cargo type.',
  addLabel: 'Trip',
  searchPlaceholder: 'Transaction #, customer, truck or driver',
  emptyLabel: 'No trips yet — record a run once a truck picks up a load.',
  columns: [
    { header: 'Transaction #', value: (r) => r.transactionNumber, kind: 'mono', sortKey: 'transactionNumber' },
    { header: 'Customer', value: (r, { language }) => localizedJoinedName(r.customerName, r.customerNameAr, language) },
    {
      header: 'Route',
      value: (r, { language }) =>
        `${localizedJoinedName(r.pickupLocationName, r.pickupLocationNameAr, language) ?? r.pickupLocationId} → ${localizedJoinedName(r.deliveryLocationName, r.deliveryLocationNameAr, language) ?? r.deliveryLocationId}`,
    },
    { header: 'Cargo', value: (r, { language }) => localizedJoinedName(r.cargoTypeName, r.cargoTypeNameAr, language) },
    { header: 'Qty', value: (r) => r.quantity, kind: 'mono', align: 'right', sortKey: 'quantity' },
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono' },
    { header: 'Driver', value: (r, { language }) => localizedJoinedName(r.driverName, r.driverNameAr, language) },
    { header: 'Date', value: (r) => formatDate(r.tripDate), kind: 'mono', sortKey: 'tripDate' },
  ],
  filters: [
    { name: 'fromDate', label: 'From Date', type: 'date' },
    { name: 'toDate', label: 'To Date', type: 'date' },
    { name: 'customerId', label: 'Customer', type: 'lookup', lookup: lookups.customers },
    { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks },
    { name: 'driverId', label: 'Driver', type: 'lookup', lookup: lookups.drivers },
    { name: 'pickupLocationId', label: 'Pickup Location', type: 'lookup', lookup: lookups.locations },
    { name: 'deliveryLocationId', label: 'Delivery Location', type: 'lookup', lookup: lookups.locations },
    { name: 'cargoTypeId', label: 'Cargo Type', type: 'lookup', lookup: lookups.cargoTypes },
  ],
  fields: [
    { name: 'transactionNumber', label: 'Transaction #', required: true },
    { name: 'customerId', label: 'Customer', type: 'lookup', lookup: lookups.customers },
    { name: 'pickupLocationId', label: 'Pickup location', type: 'lookup', lookup: lookups.locations, required: true },
    { name: 'deliveryLocationId', label: 'Delivery location', type: 'lookup', lookup: lookups.locations, required: true },
    { name: 'cargoTypeId', label: 'Cargo type', type: 'lookup', lookup: lookups.cargoTypes, required: true },
    { name: 'quantity', label: 'Quantity', type: 'decimal', required: true },
    { name: 'tripDate', label: 'Trip date', type: 'date', required: true },
    { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks, required: true },
    { name: 'assignedDriver', label: 'Assigned driver', type: 'display', render: (values) => <AssignedDriver truckId={values.truckId ?? ''} /> },
  ],
};

export function TripsScreen() {
  return <CrudScreen definition={definition} />;
}
