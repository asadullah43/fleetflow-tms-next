'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/language-context';
import { localizedName } from '../../lib/localized-name';
import { suppliersClient, SupplierDto } from '../../lib/grpc/suppliers';

export default function SuppliersPage() {
  const { token } = useAuth();
  const { language } = useLanguage();

  return (
    <CrudPage<SupplierDto>
      title="Suppliers"
      description="Manage vendors and service providers you buy fuel, parts, and services from."
      addLabel="Supplier"
      searchPlaceholder="Supplier name"
      emptyLabel="No suppliers yet."
      columns={[
        { header: 'Name', render: (r) => localizedName(r, language) },
        { header: 'Contact', render: (r) => r.contactPerson ?? '—' },
        { header: 'Phone', render: (r) => r.phone ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => suppliersClient.list(token!)}
      onCreate={(values) => suppliersClient.create(values, token!)}
      onUpdate={(id, values) => suppliersClient.update(id, values, token!)}
      onDelete={(id) => suppliersClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name (English)', required: true },
        { name: 'nameAr', label: 'Name (Arabic)' },
        { name: 'contactPerson', label: 'Contact person' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
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
      emptyValues={{ name: '', nameAr: '', contactPerson: '', phone: '', email: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        nameAr: r.nameAr ?? '',
        contactPerson: r.contactPerson ?? '',
        phone: r.phone ?? '',
        email: r.email ?? '',
        status: r.status,
      })}
    />
  );
}
