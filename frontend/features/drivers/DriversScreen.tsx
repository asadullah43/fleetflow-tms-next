'use client';

import { CrudScreen } from '../crud/CrudScreen';
import type { CrudDefinition } from '../crud/types';
import { driversApi, DriverDto } from '../../lib/api/drivers.api';
import { localizedName } from '../../lib/localized-name';

const DRIVER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const definition: CrudDefinition<DriverDto> = {
  api: driversApi,
  title: 'Drivers',
  description: 'Manage your driver roster, licenses, and availability status.',
  addLabel: 'Driver',
  searchPlaceholder: 'Driver name',
  emptyLabel: 'No drivers yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Phone', value: (r) => r.phone },
    { header: 'License no.', value: (r) => r.licenseNo },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: DRIVER_STATUSES }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'phone', label: 'Phone' },
    { name: 'licenseNo', label: 'License number' },
    { name: 'idNumber', label: 'ID number' },
    { name: 'status', label: 'Status', type: 'select', options: DRIVER_STATUSES, default: 'ACTIVE', required: true },
  ],
};

export function DriversScreen() {
  return <CrudScreen definition={definition} />;
}
