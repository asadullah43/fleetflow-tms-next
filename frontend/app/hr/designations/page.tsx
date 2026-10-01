'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { useLanguage } from '../../../lib/language-context';
import { localizedName } from '../../../lib/localized-name';
import { departmentsClient, designationsClient, DesignationDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function DesignationsPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const [opts, setOpts] = useState<{ departments: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    departmentsClient.list(token).then((deps) => setOpts({ departments: deps.map((d) => ({ value: String(d.id), label: localizedName(d, language) })) }));
  }, [token, language]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'department', label: 'Department', options: opts?.departments.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: DesignationDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.name, f.name) && match(r.departmentName, f.department) && match(statusLabel, f.status);
      },
    }),
    [opts],
  );

  if (!opts) {
    return (
      <AppShell title="Designations">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<DesignationDto>
      title="Designations"
      description="Job titles and levels, grouped by department."
      addLabel="Designation"
      emptyLabel="No designations yet."
      filterBar={filterBar}
      columns={[
        { header: 'Name', render: (r) => localizedName(r, language) },
        { header: 'Department', render: (r) => r.departmentName ?? r.departmentId },
        { header: 'Level', render: (r) => r.level ?? '—' },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => designationsClient.list(token!)}
      onCreate={(v) => designationsClient.create({ ...v, departmentId: Number(v.departmentId) }, token!)}
      onUpdate={(id, v) => designationsClient.update(id, { ...v, departmentId: Number(v.departmentId) }, token!)}
      onDelete={(id) => designationsClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Name (English)', required: true },
        { name: 'nameAr', label: 'Name (Arabic)' },
        { name: 'departmentId', label: 'Department', type: 'select', options: opts.departments, required: true },
        { name: 'level', label: 'Level' },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ name: '', nameAr: '', departmentId: '', level: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({ name: r.name, nameAr: r.nameAr ?? '', departmentId: String(r.departmentId), level: r.level ?? '', status: r.status })}
    />
  );
}
