'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { loadingOrdersClient, LoadingOrderDto } from '../../lib/grpc/loading-orders';
import { locationsClient } from '../../lib/grpc/locations';
import { customersClient } from '../../lib/grpc/customers';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';

type Opt = { value: string; label: string }[];

export default function LoadingOrdersPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ locations: Opt; customers: Opt; cargoTypes: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([locationsClient.list(token), customersClient.list(token), cargoTypesClient.list(token)]).then(([locations, customers, cargoTypes]) => {
      setOpts({
        locations: locations.map((l) => ({ value: String(l.id), label: l.name })),
        customers: customers.map((c) => ({ value: String(c.id), label: c.name })),
        cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: c.name })),
      });
    });
  }, [token]);

  if (!opts) {
    return (
      <AppShell title="Loading Orders">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  function toApi(values: Record<string, string>) {
    return {
      batchId: Number(values.batchId),
      pickupLocationId: Number(values.pickupLocationId),
      deliveryLocationId: Number(values.deliveryLocationId),
      customerId: Number(values.customerId),
      cargoTypeId: Number(values.cargoTypeId),
    };
  }

  return (
    <CrudPage<LoadingOrderDto>
      title="Loading Orders"
      addLabel="Loading Order"
      emptyLabel="No loading orders yet."
      columns={[
        { header: 'Serial #', render: (r) => <span className="mono">{r.serialNumber}</span> },
        { header: 'Batch', render: (r) => r.batchId },
        { header: 'Customer', render: (r) => r.customerName ?? r.customerId },
        { header: 'Route', render: (r) => `${r.pickupLocationName ?? r.pickupLocationId} → ${r.deliveryLocationName ?? r.deliveryLocationId}` },
        { header: 'Cargo', render: (r) => r.cargoTypeName ?? r.cargoTypeId },
      ]}
      fetchAll={() => loadingOrdersClient.list(token!)}
      onCreate={(values) => loadingOrdersClient.create(toApi(values), token!)}
      onUpdate={(id, values) => loadingOrdersClient.update(id, toApi(values), token!)}
      onDelete={(id) => loadingOrdersClient.remove(id, token!)}
      formFields={[
        { name: 'batchId', label: 'Batch ID', required: true },
        { name: 'pickupLocationId', label: 'Pickup location', type: 'select', options: opts.locations, required: true },
        { name: 'deliveryLocationId', label: 'Delivery location', type: 'select', options: opts.locations, required: true },
        { name: 'customerId', label: 'Customer', type: 'select', options: opts.customers, required: true },
        { name: 'cargoTypeId', label: 'Cargo type', type: 'select', options: opts.cargoTypes, required: true },
      ]}
      emptyValues={{ batchId: '', pickupLocationId: '', deliveryLocationId: '', customerId: '', cargoTypeId: '' }}
      toFormValues={(r) => ({
        batchId: String(r.batchId),
        pickupLocationId: String(r.pickupLocationId),
        deliveryLocationId: String(r.deliveryLocationId),
        customerId: String(r.customerId),
        cargoTypeId: String(r.cargoTypeId),
      })}
    />
  );
}
