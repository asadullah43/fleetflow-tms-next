'use client';

import { useMemo } from 'react';
import { CrudPage } from '../../components/CrudPage';
import { PageLoading } from '../../components/PageLoading';
import { useAuth } from '../../lib/auth-context';
import { useLookups } from '../../lib/use-lookups';
import { useLanguage } from '../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../lib/localized-name';
import { tripsClient, TripDto } from '../../lib/grpc/trips';
import { customersClient } from '../../lib/grpc/customers';
import { locationsClient } from '../../lib/grpc/locations';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';
import { trucksClient } from '../../lib/grpc/trucks';
import { driversClient } from '../../lib/grpc/drivers';
import { assignmentsClient, AssignmentDto } from '../../lib/grpc/assignments';

type Opt = { value: string; label: string }[];

/** The driver currently assigned to a truck (matches the overlap rule in assignments.service.ts). */
function currentAssignment(assignments: AssignmentDto[], truckId: number): AssignmentDto | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return assignments
    .filter((a) => a.truckId === truckId && a.startDate.slice(0, 10) <= today && (!a.endDate || a.endDate.slice(0, 10) >= today))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export default function TripsPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const { data: opts, error: lookupError } = useLookups<{
    customers: Opt;
    locations: Opt;
    cargoTypes: Opt;
    trucks: Opt;
    drivers: Opt;
    assignments: AssignmentDto[];
  }>(async (token) => {
    const [customers, locations, cargoTypes, trucks, drivers, assignments] = await Promise.all([
      customersClient.list(token),
      locationsClient.list(token),
      cargoTypesClient.list(token),
      trucksClient.list(token),
      driversClient.list(token),
      assignmentsClient.list(token),
    ]);
    return {
      customers: customers.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
      locations: locations.map((l) => ({ value: String(l.id), label: localizedName(l, language) })),
      cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
      trucks: trucks.map((t) => ({ value: String(t.id), label: t.truckNumber })),
      drivers: drivers.map((d) => ({ value: String(d.id), label: localizedName(d, language) })),
      assignments,
    };
  }, [language]);
  const assignments = opts?.assignments ?? [];

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'fromDate', label: 'From Date', type: 'date' as const },
        { name: 'toDate', label: 'To Date', type: 'date' as const },
        { name: 'transactionNumber', label: 'Transaction #' },
        { name: 'customer', label: 'Customer', options: opts?.customers.map((o) => o.label) ?? [] },
        { name: 'driver', label: 'Driver', options: opts?.drivers.map((o) => o.label) ?? [] },
        { name: 'truck', label: 'Truck', options: opts?.trucks.map((o) => o.label) ?? [] },
        { name: 'pickup', label: 'Pickup Location', options: opts?.locations.map((o) => o.label) ?? [] },
        { name: 'delivery', label: 'Delivery Location', options: opts?.locations.map((o) => o.label) ?? [] },
        { name: 'cargoType', label: 'Cargo Type', options: opts?.cargoTypes.map((o) => o.label) ?? [] },
      ],
      apply: (r: TripDto, f: Record<string, string>) => {
        const day = r.tripDate?.slice(0, 10) ?? '';
        if (f.fromDate && day < f.fromDate) return false;
        if (f.toDate && day > f.toDate) return false;
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        return (
          match(r.transactionNumber, f.transactionNumber) &&
          match(r.customerName, f.customer) &&
          match(r.driverName, f.driver) &&
          match(r.truckNumber, f.truck) &&
          match(r.pickupLocationName, f.pickup) &&
          match(r.deliveryLocationName, f.delivery) &&
          match(r.cargoTypeName, f.cargoType)
        );
      },
    }),
    [opts]
  );

  function onValuesChange(name: string, value: string) {
    if (name === 'truckId') {
      const assignment = value ? currentAssignment(assignments, Number(value)) : undefined;
      return {
        driverId: assignment ? String(assignment.driverId) : '',
        driverName: (assignment ? localizedJoinedName(assignment.driverName, assignment.driverNameAr, language) : undefined) ?? (value ? 'No driver currently assigned to this truck' : ''),
      };
    }
  }

  if (!opts) return <PageLoading title="Trips" error={lookupError} />;

  function toApi(values: Record<string, string>) {
    return {
      transactionNumber: values.transactionNumber,
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
      filterBar={filterBar}
      onValuesChange={onValuesChange}
      columns={[
        { header: 'Transaction #', render: (r) => <span className="mono">{r.transactionNumber}</span> },
        {
          header: 'Route',
          render: (r) =>
            `${localizedJoinedName(r.pickupLocationName, r.pickupLocationNameAr, language) ?? r.pickupLocationId} → ${localizedJoinedName(r.deliveryLocationName, r.deliveryLocationNameAr, language) ?? r.deliveryLocationId}`,
        },
        { header: 'Cargo', render: (r) => localizedJoinedName(r.cargoTypeName, r.cargoTypeNameAr, language) ?? r.cargoTypeId },
        { header: 'Qty', render: (r) => r.quantity, align: 'right' },
        { header: 'Truck', render: (r) => r.truckNumber ?? r.truckId },
        { header: 'Date', render: (r) => r.tripDate?.slice(0, 10) },
      ]}
      fetchAll={() => tripsClient.list(token!)}
      onCreate={(values) => tripsClient.create(toApi(values), token!)}
      onUpdate={(id, values) => tripsClient.update(id, toApi(values), token!)}
      onDelete={(id) => tripsClient.remove(id, token!)}
      formFields={[
        { name: 'transactionNumber', label: 'Transaction #', required: true },
        { name: 'customerId', label: 'Customer', type: 'select', options: opts.customers },
        { name: 'pickupLocationId', label: 'Pickup location', type: 'select', options: opts.locations, required: true },
        { name: 'deliveryLocationId', label: 'Delivery location', type: 'select', options: opts.locations, required: true },
        { name: 'cargoTypeId', label: 'Cargo type', type: 'select', options: opts.cargoTypes, required: true },
        { name: 'quantity', label: 'Quantity', required: true },
        { name: 'tripDate', label: 'Trip date', type: 'date', required: true },
        { name: 'truckId', label: 'Truck', type: 'select', options: opts.trucks, required: true },
        { name: 'driverName', label: 'Assigned driver', readOnly: true },
      ]}
      emptyValues={{
        transactionNumber: '',
        customerId: '',
        pickupLocationId: '',
        deliveryLocationId: '',
        cargoTypeId: '',
        quantity: '',
        tripDate: '',
        truckId: '',
        driverId: '',
        driverName: '',
      }}
      toFormValues={(r) => ({
        transactionNumber: r.transactionNumber,
        customerId: r.customerId ? String(r.customerId) : '',
        pickupLocationId: String(r.pickupLocationId),
        deliveryLocationId: String(r.deliveryLocationId),
        cargoTypeId: String(r.cargoTypeId),
        quantity: r.quantity,
        tripDate: r.tripDate?.slice(0, 10) ?? '',
        truckId: String(r.truckId),
        driverId: r.driverId ? String(r.driverId) : '',
        driverName: localizedJoinedName(r.driverName, r.driverNameAr, language) ?? '',
      })}
    />
  );
}
