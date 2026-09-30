'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { cargoTypesClient, CargoTypeDto } from '../../lib/grpc/cargo-types';

export default function CargoTypesPage() {
  const { token } = useAuth();

  return (
    <CrudPage<CargoTypeDto>
      title="Cargo Types"
      addLabel="Cargo Type"
      emptyLabel="No cargo types yet."
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Pricing mode', render: (r) => (r.pricingMode === 'PER_MT' ? 'Per metric ton' : 'Per trip') },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => cargoTypesClient.list(token!)}
      onCreate={(values) => cargoTypesClient.create(values, token!)}
      onUpdate={(id, values) => cargoTypesClient.update(id, values, token!)}
      onDelete={(id) => cargoTypesClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'language',
          label: 'Language of name above',
          type: 'select',
          options: [
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'Arabic' },
          ],
        },
        { name: 'description', label: 'Description', type: 'textarea' },
        {
          name: 'pricingMode',
          label: 'Pricing mode',
          type: 'select',
          options: [
            { value: 'PER_MT', label: 'Per metric ton' },
            { value: 'PER_TRIP', label: 'Per trip' },
          ],
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        },
      ]}
      emptyValues={{ name: '', language: 'en', description: '', pricingMode: 'PER_MT', status: 'ACTIVE' }}
      toFormValues={(r) => ({ name: r.name, language: 'en', description: r.description ?? '', pricingMode: r.pricingMode, status: r.status })}
    />
  );
}
