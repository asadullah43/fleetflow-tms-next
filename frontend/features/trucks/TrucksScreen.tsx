'use client';

import { CrudScreen } from '../crud/CrudScreen';
import type { CrudDefinition } from '../crud/types';
import { trucksApi, TruckDto } from '../../lib/api/trucks.api';

const TRUCK_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const definition: CrudDefinition<TruckDto> = {
  api: trucksApi,
  title: 'Trucks',
  description: 'Manage your fleet vehicles, maintenance schedules, and truck assignments.',
  addLabel: 'Truck',
  searchPlaceholder: 'Truck number',
  emptyLabel: 'No trucks yet — add your first vehicle to start scheduling trips.',
  columns: [
    { header: 'Truck number', value: (r) => r.truckNumber, kind: 'mono', sortKey: 'truckNumber', href: (r) => `/trucks/${r.id}` },
    { header: 'Type', value: (r) => r.truckType, sortKey: 'truckType' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: TRUCK_STATUSES }],
  fields: [
    { name: 'truckNumber', label: 'Truck number', required: true },
    { name: 'truckType', label: 'Truck type' },
    { name: 'status', label: 'Status', type: 'select', options: TRUCK_STATUSES, default: 'ACTIVE', required: true },
  ],
};

export function TrucksScreen() {
  return <CrudScreen definition={definition} />;
}
