'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { rateContractsClient, RateContractDto } from '../../lib/grpc/rate-contracts';
import { customersClient } from '../../lib/grpc/customers';
import { locationsClient } from '../../lib/grpc/locations';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';

type Opt = { value: string; label: string }[];

export default function RateContractsPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ customers: Opt; locations: Opt; cargoTypes: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([customersClient.list(token), locationsClient.list(token), cargoTypesClient.list(token)]).then(([customers, locations, cargoTypes]) => {
      setOpts({
        customers: customers.map((c) => ({ value: String(c.id), label: c.name })),
        locations: locations.map((l) => ({ value: String(l.id), label: l.name })),
        cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: c.name })),
      });
    });
  }, [token]);

  if (!opts) {
    return (
      <AppShell title="Rate Contracts">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  function toApi(values: Record<string, string>) {
    return {
      customerId: Number(values.customerId),
      pickupLocationId: Number(values.pickupLocationId),
      deliveryLocationId: Number(values.deliveryLocationId),
      cargoTypeId: Number(values.cargoTypeId),
      rate: values.rate,
      currency: values.currency || 'SAR',
    };
  }

  return (
    <CrudPage<RateContractDto>
      title="Rate Contracts"
      description="Manage negotiated per-customer rates for a route and cargo type."
      addLabel="Rate Contract"
      searchPlaceholder="Customer, route, or cargo"
      emptyLabel="No negotiated rates yet."
      columns={[
        { header: 'Customer', render: (r) => r.customerName ?? r.customerId },
        { header: 'Route', render: (r) => `${r.pickupLocationName ?? r.pickupLocationId} → ${r.deliveryLocationName ?? r.deliveryLocationId}` },
        { header: 'Cargo', render: (r) => r.cargoTypeName ?? r.cargoTypeId },
        { header: 'Rate', render: (r) => `${r.rate} ${r.currency}`, align: 'right' },
      ]}
      fetchAll={() => rateContractsClient.list(token!)}
      onCreate={(values) => rateContractsClient.create(toApi(values), token!)}
      onUpdate={(id, values) => rateContractsClient.update(id, toApi(values), token!)}
      onDelete={(id) => rateContractsClient.remove(id, token!)}
      formFields={[
        { name: 'customerId', label: 'Customer', type: 'select', options: opts.customers, required: true },
        { name: 'pickupLocationId', label: 'Pickup location', type: 'select', options: opts.locations, required: true },
        { name: 'deliveryLocationId', label: 'Delivery location', type: 'select', options: opts.locations, required: true },
        { name: 'cargoTypeId', label: 'Cargo type', type: 'select', options: opts.cargoTypes, required: true },
        { name: 'rate', label: 'Rate', required: true },
        { name: 'currency', label: 'Currency' },
      ]}
      emptyValues={{ customerId: '', pickupLocationId: '', deliveryLocationId: '', cargoTypeId: '', rate: '', currency: 'SAR' }}
      toFormValues={(r) => ({
        customerId: String(r.customerId),
        pickupLocationId: String(r.pickupLocationId),
        deliveryLocationId: String(r.deliveryLocationId),
        cargoTypeId: String(r.cargoTypeId),
        rate: r.rate,
        currency: r.currency,
      })}
    />
  );
}
