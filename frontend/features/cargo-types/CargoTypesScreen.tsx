'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { cargoTypesApi, CargoTypeDto } from '../../lib/api/cargo-types.api';
import { localizedName } from '../../lib/localized-name';

const PRICING_MODES = [
  { value: 'PER_MT', label: 'Per metric ton' },
  { value: 'PER_TRIP', label: 'Per trip' },
];

const definition: CrudDefinition<CargoTypeDto> = {
  api: cargoTypesApi,
  title: 'Cargo Types',
  description: 'Manage the kinds of cargo you haul and how each is priced.',
  addLabel: 'Cargo Type',
  searchPlaceholder: 'Cargo type name',
  emptyLabel: 'No cargo types yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Pricing mode', value: (r, { t }) => t(r.pricingMode === 'PER_MT' ? 'Per metric ton' : 'Per trip'), sortKey: 'pricingMode' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'pricingMode', label: 'Pricing mode', type: 'select', options: PRICING_MODES, default: 'PER_MT', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};

export function CargoTypesScreen() {
  return <CrudScreen definition={definition} />;
}
