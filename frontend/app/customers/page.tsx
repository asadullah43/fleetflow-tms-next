'use client';

import { CrudPage } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { customersClient, CustomerDto } from '../../lib/grpc/customers';

export default function CustomersPage() {
  const { token } = useAuth();

  return (
    <CrudPage<CustomerDto>
      title="Customers"
      addLabel="Customer"
      emptyLabel="No customers yet."
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Contact', render: (r) => r.contactPerson ?? '—' },
        { header: 'Phone', render: (r) => r.phone ?? '—' },
        { header: 'City', render: (r) => r.city ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => customersClient.list(token!)}
      onCreate={(values) => customersClient.create(values, token!)}
      onUpdate={(id, values) => customersClient.update(id, values, token!)}
      onDelete={(id) => customersClient.remove(id, token!)}
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
        { name: 'contactPerson', label: 'Contact person' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
        { name: 'vatNumber', label: 'VAT number' },
        { name: 'crNumber', label: 'CR number' },
        { name: 'city', label: 'City' },
        { name: 'country', label: 'Country' },
        { name: 'streetName', label: 'Street' },
        { name: 'buildingNumber', label: 'Building number' },
        { name: 'postalCode', label: 'Postal code' },
        { name: 'address', label: 'Address', type: 'textarea' },
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
      emptyValues={{
        name: '',
        language: 'en',
        contactPerson: '',
        phone: '',
        email: '',
        vatNumber: '',
        crNumber: '',
        city: '',
        country: 'SA',
        streetName: '',
        buildingNumber: '',
        postalCode: '',
        address: '',
        status: 'ACTIVE',
      }}
      toFormValues={(r) => ({
        name: r.name,
        language: 'en',
        contactPerson: r.contactPerson ?? '',
        phone: r.phone ?? '',
        email: r.email ?? '',
        vatNumber: r.vatNumber ?? '',
        crNumber: r.crNumber ?? '',
        city: r.city ?? '',
        country: r.country ?? 'SA',
        streetName: r.streetName ?? '',
        buildingNumber: r.buildingNumber ?? '',
        postalCode: r.postalCode ?? '',
        address: r.address ?? '',
        status: r.status,
      })}
    />
  );
}
