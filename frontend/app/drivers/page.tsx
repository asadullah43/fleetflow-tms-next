'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { driversClient, DriverDto } from '../../lib/grpc/drivers';

export default function DriversPage() {
  const { token } = useAuth();

  return (
    <CrudPage<DriverDto>
      title="Drivers"
      description="Manage your driver roster, licenses, and availability status."
      addLabel="Driver"
      searchPlaceholder="Driver name"
      emptyLabel="No drivers yet."
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Phone', render: (r) => r.phone ?? '—' },
        { header: 'License no.', render: (r) => r.licenseNo ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => driversClient.list(token!)}
      onCreate={(values) => driversClient.create(values, token!)}
      onUpdate={(id, values) => driversClient.update(id, values, token!)}
      onDelete={(id) => driversClient.remove(id, token!)}
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
        { name: 'phone', label: 'Phone' },
        { name: 'licenseNo', label: 'License number' },
        { name: 'idNumber', label: 'ID number' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'ON_LEAVE', label: 'On leave' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        },
      ]}
      emptyValues={{ name: '', language: 'en', phone: '', licenseNo: '', idNumber: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        language: 'en',
        phone: r.phone ?? '',
        licenseNo: r.licenseNo ?? '',
        idNumber: r.idNumber ?? '',
        status: r.status,
      })}
    />
  );
}
