'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { departmentsClient, designationsClient, employeesClient, EmployeeDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'TERMINATED', label: 'Terminated' },
];

export default function EmployeesPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ departments: Opt; designations: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([departmentsClient.list(token), designationsClient.list(token)]).then(([deps, desigs]) => {
      setOpts({
        departments: deps.map((d) => ({ value: String(d.id), label: d.name })),
        designations: desigs.map((d) => ({ value: String(d.id), label: d.name })),
      });
    });
  }, [token]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'employeeNumber', label: 'Employee #' },
        { name: 'name', label: 'Name' },
        { name: 'department', label: 'Department', options: opts?.departments.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: EmployeeDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.employmentStatus)?.label ?? r.employmentStatus;
        return (
          match(r.employeeNumber, f.employeeNumber) &&
          match(r.name, f.name) &&
          match(r.departmentName, f.department) &&
          match(statusLabel, f.status)
        );
      },
    }),
    [opts],
  );

  if (!opts) {
    return (
      <AppShell title="Employees">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<EmployeeDto>
      title="Employees"
      description="Employee roster with department, designation, and employment status."
      addLabel="Employee"
      emptyLabel="No employees yet."
      filterBar={filterBar}
      columns={[
        { header: 'Employee #', render: (r) => <span className="mono">{r.employeeNumber}</span> },
        { header: 'Name', render: (r) => r.name },
        { header: 'Department', render: (r) => r.departmentName ?? r.departmentId },
        { header: 'Status', render: (r) => <StatusBadge status={r.employmentStatus} /> },
      ]}
      fetchAll={() => employeesClient.list(token!)}
      onCreate={(v) =>
        employeesClient.create(
          { ...v, departmentId: Number(v.departmentId), designationId: v.designationId ? Number(v.designationId) : undefined },
          token!,
        )
      }
      onUpdate={(id, v) =>
        employeesClient.update(
          id,
          { ...v, departmentId: Number(v.departmentId), designationId: v.designationId ? Number(v.designationId) : undefined },
          token!,
        )
      }
      onDelete={(id) => employeesClient.remove(id, token!)}
      formFields={[
        { name: 'name', label: 'Full name', required: true },
        { name: 'language', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }] },
        { name: 'email', label: 'Email' },
        { name: 'phone', label: 'Phone' },
        { name: 'joiningDate', label: 'Joining date', type: 'date', required: true },
        { name: 'departmentId', label: 'Department', type: 'select', options: opts.departments, required: true },
        { name: 'designationId', label: 'Designation', type: 'select', options: opts.designations },
        {
          name: 'employmentType',
          label: 'Employment type',
          type: 'select',
          options: [{ value: 'FULL_TIME', label: 'Full time' }, { value: 'PART_TIME', label: 'Part time' }, { value: 'CONTRACT', label: 'Contract' }],
        },
        { name: 'employmentStatus', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ name: '', language: 'en', email: '', phone: '', joiningDate: '', departmentId: '', designationId: '', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE' }}
      toFormValues={(r) => ({
        name: r.name,
        language: 'en',
        email: r.email ?? '',
        phone: r.phone ?? '',
        joiningDate: r.joiningDate?.slice(0, 10) ?? '',
        departmentId: String(r.departmentId),
        designationId: r.designationId ? String(r.designationId) : '',
        employmentType: r.employmentType,
        employmentStatus: r.employmentStatus,
      })}
    />
  );
}
