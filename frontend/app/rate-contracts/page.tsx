'use client';

import { CrudPage } from '../../components/CrudPage';
import { PageLoading } from '../../components/PageLoading';
import { useAuth } from '../../lib/auth-context';
import { useLookups } from '../../lib/use-lookups';
import { useLanguage } from '../../lib/language-context';
import { localizedName, localizedJoinedName } from '../../lib/localized-name';
import { rateContractsClient, RateContractDto } from '../../lib/grpc/rate-contracts';
import { customersClient } from '../../lib/grpc/customers';
import { locationsClient } from '../../lib/grpc/locations';
import { cargoTypesClient } from '../../lib/grpc/cargo-types';

type Opt = { value: string; label: string }[];

export default function RateContractsPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const { data: opts, error: lookupError } = useLookups<{ customers: Opt; locations: Opt; cargoTypes: Opt }>(async (token) => {
    const [customers, locations, cargoTypes] = await Promise.all([customersClient.list(token), locationsClient.list(token), cargoTypesClient.list(token)]);
    return {
      customers: customers.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
      locations: locations.map((l) => ({ value: String(l.id), label: localizedName(l, language) })),
      cargoTypes: cargoTypes.map((c) => ({ value: String(c.id), label: localizedName(c, language) })),
    };
  }, [language]);

  if (!opts) return <PageLoading title="Rate Contracts" error={lookupError} />;

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
        { header: 'Customer', render: (r) => localizedJoinedName(r.customerName, r.customerNameAr, language) ?? r.customerId },
        {
          header: 'Route',
          render: (r) =>
            `${localizedJoinedName(r.pickupLocationName, r.pickupLocationNameAr, language) ?? r.pickupLocationId} → ${localizedJoinedName(r.deliveryLocationName, r.deliveryLocationNameAr, language) ?? r.deliveryLocationId}`,
        },
        { header: 'Cargo', render: (r) => localizedJoinedName(r.cargoTypeName, r.cargoTypeNameAr, language) ?? r.cargoTypeId },
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
