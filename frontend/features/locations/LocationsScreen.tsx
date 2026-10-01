'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { locationsApi, LocationDto } from '../../lib/api/locations.api';
import { localizedDescription, localizedName } from '../../lib/localized-name';

const definition: CrudDefinition<LocationDto> = {
  api: locationsApi,
  title: 'Locations',
  description: 'Manage pickup and delivery points used when scheduling trips.',
  addLabel: 'Location',
  searchPlaceholder: 'Location name',
  emptyLabel: 'No locations yet — add pickup and delivery points to use them on trips.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Description', value: (r, { language }) => localizedDescription(r, language) },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'description', label: 'Description (English)', type: 'textarea' },
    { name: 'descriptionAr', label: 'Description (Arabic)', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};

export function LocationsScreen() {
  return <CrudScreen definition={definition} />;
}
