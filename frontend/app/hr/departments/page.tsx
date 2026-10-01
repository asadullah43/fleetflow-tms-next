'use client';

import { useMemo } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { departmentsClient, DepartmentDto } from '../../../lib/grpc/hr';

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function DepartmentsPage() {
  const { token } = useAuth();

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: DepartmentDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.name, f.name) && match(statusLabel, f.status);
      },
    }),
    [],
  );

  return (
    <CrudPage<DepartmentDto>
      title="Departments"
      description="Organizational departments used across employee records."
      addLabel="Department"
      emptyLabel="No departments yet."
      filterBar={filterBar}
      columns={[
        { header: 'Name', render: (r) => r.name },
        { header: 'Description', render: (r) => r.description ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => departmentsClient.list(token!)}
      onCreate={(v) => departmentsClient.create(v, token!)}
      onUpdate={(id, v) => departmentsClient.update(id, v, token!)}
      onDelete={(id) => departmentsClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'language', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ name: '', language: 'en', description: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({ name: r.name, language: 'en', description: r.description ?? '', status: r.status })}
    />
  );
}
