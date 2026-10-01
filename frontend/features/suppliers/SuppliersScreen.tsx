'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { suppliersApi, SupplierDto } from '../../lib/api/suppliers.api';
import { localizedName } from '../../lib/localized-name';

const definition: CrudDefinition<SupplierDto> = {
  api: suppliersApi,
  title: 'Suppliers',
  description: 'Manage vendors and service providers you buy fuel, parts, and services from.',
  addLabel: 'Supplier',
  searchPlaceholder: 'Supplier name',
  emptyLabel: 'No suppliers yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Contact', value: (r) => r.contactPerson },
    { header: 'Phone', value: (r) => r.phone },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'contactPerson', label: 'Contact person' },
    { name: 'phone', label: 'Phone' },
    { name: 'email', label: 'Email' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};

export function SuppliersScreen() {
  return <CrudScreen definition={definition} />;
}
