'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { customersApi, CustomerDto } from '../../lib/api/customers.api';
import { localizedName } from '../../lib/localized-name';

const definition: CrudDefinition<CustomerDto> = {
  api: customersApi,
  title: 'Customers',
  description: 'Manage the customers you move cargo for, and their billing details.',
  addLabel: 'Customer',
  searchPlaceholder: 'Customer name',
  emptyLabel: 'No customers yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Contact', value: (r) => r.contactPerson },
    { header: 'Phone', value: (r) => r.phone },
    { header: 'City', value: (r) => r.city },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'contactPerson', label: 'Contact person' },
    { name: 'phone', label: 'Phone' },
    { name: 'email', label: 'Email' },
    { name: 'vatNumber', label: 'VAT number' },
    { name: 'crNumber', label: 'CR number' },
    { name: 'city', label: 'City' },
    { name: 'country', label: 'Country', default: 'SA' },
    { name: 'streetName', label: 'Street' },
    { name: 'buildingNumber', label: 'Building number' },
    { name: 'postalCode', label: 'Postal code' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};

export function CustomersScreen() {
  return <CrudScreen definition={definition} />;
}
