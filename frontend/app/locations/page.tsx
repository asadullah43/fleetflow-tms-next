'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/language-context';
import { localizedName, localizedDescription } from '../../lib/localized-name';
import { locationsClient, LocationDto } from '../../lib/grpc/locations';

export default function LocationsPage() {
  const { token } = useAuth();
  const { language } = useLanguage();

  return (
    <CrudPage<LocationDto>
      title="Locations"
      description="Manage pickup and delivery points used when scheduling trips."
      addLabel="Location"
      searchPlaceholder="Location name"
      emptyLabel="No locations yet — add pickup and delivery points to use them on trips."
      columns={[
        { header: 'Name', render: (r) => localizedName(r, language) },
        { header: 'Description', render: (r) => localizedDescription(r, language) ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => locationsClient.list(token!)}
      onCreate={(values) => locationsClient.create(values, token!)}
      onUpdate={(id, values) => locationsClient.update(id, values, token!)}
      onDelete={(id) => locationsClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name (English)', required: true },
        { name: 'nameAr', label: 'Name (Arabic)' },
        { name: 'description', label: 'Description (English)', type: 'textarea' },
        { name: 'descriptionAr', label: 'Description (Arabic)', type: 'textarea' },
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
      emptyValues={{ name: '', nameAr: '', description: '', descriptionAr: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        nameAr: r.nameAr ?? '',
        description: r.description ?? '',
        descriptionAr: r.descriptionAr ?? '',
        status: r.status,
      })}
    />
  );
}
