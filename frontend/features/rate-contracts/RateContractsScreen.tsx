'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { rateContractsApi, RateContractDto } from '../../lib/api/rate-contracts.api';
import { localizedJoinedName } from '../../lib/localized-name';

const definition: CrudDefinition<RateContractDto> = {
  api: rateContractsApi,
  title: 'Rate Contracts',
  description: 'Manage negotiated per-customer rates for a route and cargo type.',
  addLabel: 'Rate Contract',
  searchPlaceholder: 'Customer, route, or cargo',
  emptyLabel: 'No negotiated rates yet.',
  columns: [
    { header: 'Customer', value: (r, { language }) => localizedJoinedName(r.customerName, r.customerNameAr, language), sortKey: 'customerName' },
    {
      header: 'Route',
      value: (r, { language }) =>
        `${localizedJoinedName(r.pickupLocationName, r.pickupLocationNameAr, language) ?? r.pickupLocationId} → ${localizedJoinedName(r.deliveryLocationName, r.deliveryLocationNameAr, language) ?? r.deliveryLocationId}`,
    },
    { header: 'Cargo', value: (r, { language }) => localizedJoinedName(r.cargoTypeName, r.cargoTypeNameAr, language) },
    { header: 'Rate', value: (r) => `${r.rate} ${r.currency}`, kind: 'mono', align: 'right', sortKey: 'rate' },
  ],
  filters: [
    { name: 'customerId', label: 'Customer', type: 'lookup', lookup: lookups.customers },
    { name: 'cargoTypeId', label: 'Cargo Type', type: 'lookup', lookup: lookups.cargoTypes },
  ],
  fields: [
    { name: 'customerId', label: 'Customer', type: 'lookup', lookup: lookups.customers, required: true },
    { name: 'pickupLocationId', label: 'Pickup location', type: 'lookup', lookup: lookups.locations, required: true },
    { name: 'deliveryLocationId', label: 'Delivery location', type: 'lookup', lookup: lookups.locations, required: true },
    { name: 'cargoTypeId', label: 'Cargo type', type: 'lookup', lookup: lookups.cargoTypes, required: true },
    { name: 'rate', label: 'Rate', type: 'decimal', required: true },
    { name: 'currency', label: 'Currency', default: 'SAR' },
  ],
  toApi: (payload) => ({ ...payload, currency: payload.currency || 'SAR' }),
};

export function RateContractsScreen() {
  return <CrudScreen definition={definition} />;
}
