'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { locationsClient, LocationDto } from '../../lib/grpc/locations';

export default function LocationsPage() {
  const { token } = useAuth();

  return (
    <CrudPage<LocationDto>
      title="Locations"
      addLabel="Location"
      emptyLabel="No locations yet — add pickup and delivery points to use them on trips."
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Arabic name', render: (r) => r.nameAr ?? '—' },
        { header: 'Description', render: (r) => r.description ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => locationsClient.list(token!)}
      onCreate={(values) => locationsClient.create(values, token!)}
      onUpdate={(id, values) => locationsClient.update(id, values, token!)}
      onDelete={(id) => locationsClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'language',
          label: 'Language of name/description above',
          type: 'select',
          options: [
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'Arabic' },
          ],
        },
        { name: 'description', label: 'Description', type: 'textarea' },
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
      emptyValues={{ name: '', language: 'en', description: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({ name: r.name, language: 'en', description: r.description ?? '', status: r.status })}
    />
  );
}
