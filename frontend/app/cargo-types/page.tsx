'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedName } from '../../lib/localized-name';
import { cargoTypesClient, CargoTypeDto } from '../../lib/grpc/cargo-types';

export default function CargoTypesPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = useT();

  return (
    <CrudPage<CargoTypeDto>
      title="Cargo Types"
      description="Manage the kinds of cargo you haul and how each is priced."
      addLabel="Cargo Type"
      searchPlaceholder="Cargo type name"
      emptyLabel="No cargo types yet."
      columns={[
        { header: 'Name', render: (r) => localizedName(r, language) },
        { header: 'Pricing mode', render: (r) => t(r.pricingMode === 'PER_MT' ? 'Per metric ton' : 'Per trip') },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => cargoTypesClient.list(token!)}
      onCreate={(values) => cargoTypesClient.create(values, token!)}
      onUpdate={(id, values) => cargoTypesClient.update(id, values, token!)}
      onDelete={(id) => cargoTypesClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name (English)', required: true },
        { name: 'nameAr', label: 'Name (Arabic)' },
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
      emptyValues={{ name: '', nameAr: '', description: '', pricingMode: 'PER_MT', status: 'ACTIVE' }}
      toFormValues={(r) => ({ name: r.name, nameAr: r.nameAr ?? '', description: r.description ?? '', pricingMode: r.pricingMode, status: r.status })}
    />
  );
}
