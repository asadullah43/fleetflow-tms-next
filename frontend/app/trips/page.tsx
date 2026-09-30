'use client';

import { useEffect, useState } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { tripsClient, TripDto } from '../../lib/grpc/trips';
import { suppliersClient } from '../../lib/grpc/suppliers';
import { customersClient } from '../../lib/grpc/customers';
import { locationsClient } from '../../lib/grpc/locations';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';
import { trucksClient } from '../../lib/grpc/trucks';
import { driversClient } from '../../lib/grpc/drivers';

type Opt = { value: string; label: string }[];

export default function TripsPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ suppliers: Opt; customers: Opt; locations: Opt; cargoTypes: Opt; trucks: Opt; drivers: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      suppliersClient.list(token),
      customersClient.list(token),
      locationsClient.list(token),
      cargoTypesClient.list(token),
      trucksClient.list(token),
      driversClient.list(token),
    ]).then(([suppliers, customers, locations, cargoTypes, trucks, drivers]) => {
      setOpts({
        suppliers: suppliers.map((s) => ({ value: String(s.id), label: s.name })),
        customers: customers.map((c) => ({ value: String(c.id), label: c.name })),
        locations: locations.map((l) => ({ value: String(l.id), label: l.name })),
        cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: c.name })),
        trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })),
        drivers: drivers.map((d) => ({ value: String(d.id), label: d.name })),
      });
    });
  }, [token]);

  if (!opts) {
    return (
      <AppShell title="Trips">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  function toApi(values: Record<string, string>) {
    return {
      supplierId: values.supplierId ? Number(values.supplierId) : undefined,
      customerId: values.customerId ? Number(values.customerId) : undefined,
      pickupLocationId: Number(values.pickupLocationId),
      deliveryLocationId: Number(values.deliveryLocationId),
      cargoTypeId: Number(values.cargoTypeId),
      quantity: values.quantity,
      tripDate: values.tripDate,
      truckId: Number(values.truckId),
      driverId: values.driverId ? Number(values.driverId) : undefined,
    };
  }

  return (
    <CrudPage<TripDto>
      title="Trips"
      addLabel="Trip"
      emptyLabel="No trips yet — record a run once a truck picks up a load."
      columns={[
        { header: 'Transaction #', render: (r) => <span className="mono">{r.transactionNumber}</span> },
        { header: 'Route', render: (r) => `${r.pickupLocationName ?? r.pickupLocationId} → ${r.deliveryLocationName ?? r.deliveryLocationId}` },
        { header: 'Cargo', render: (r) => r.cargoTypeName ?? r.cargoTypeId },
        { header: 'Qty', render: (r) => r.quantity, align: 'right' },
        { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
        { header: 'Date', render: (r) => r.tripDate?.slice(0, 10) },
      ]}
      fetchAll={() => tripsClient.list(token!)}
      onCreate={(values) => tripsClient.create(toApi(values), token!)}
      onUpdate={(id, values) => tripsClient.update(id, toApi(values), token!)}
      onDelete={(id) => tripsClient.remove(id, token!)}
      formFields={[
        { name: 'customerId', label: 'Customer', type: 'select', options: opts.customers },
        { name: 'supplierId', label: 'Supplier', type: 'select', options: opts.suppliers },
        { name: 'pickupLocationId', label: 'Pickup location', type: 'select', options: opts.locations, required: true },
        { name: 'deliveryLocationId', label: 'Delivery location', type: 'select', options: opts.locations, required: true },
        { name: 'cargoTypeId', label: 'Cargo type', type: 'select', options: opts.cargoTypes, required: true },
        { name: 'quantity', label: 'Quantity', required: true },
        { name: 'tripDate', label: 'Trip date', required: true },
        { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
        { name: 'driverId', label: 'Driver', type: 'select', options: opts.drivers },
      ]}
      emptyValues={{
        customerId: '',
        supplierId: '',
        pickupLocationId: '',
        deliveryLocationId: '',
        cargoTypeId: '',
        quantity: '',
        tripDate: '',
        truckId: '',
        driverId: '',
      }}
      toFormValues={(r) => ({
        customerId: r.customerId ? String(r.customerId) : '',
        supplierId: r.supplierId ? String(r.supplierId) : '',
        pickupLocationId: String(r.pickupLocationId),
        deliveryLocationId: String(r.deliveryLocationId),
        cargoTypeId: String(r.cargoTypeId),
        quantity: r.quantity,
        tripDate: r.tripDate?.slice(0, 10) ?? '',
        truckId: String(r.truckId),
        driverId: r.driverId ? String(r.driverId) : '',
      })}
    />
  );
}
