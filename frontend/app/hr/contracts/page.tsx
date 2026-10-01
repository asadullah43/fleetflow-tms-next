'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { employeesClient, employmentContractsClient, EmploymentContractDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

const CONTRACT_TYPES = [
  { value: 'FIXED_TERM', label: 'Fixed term' },
  { value: 'UNLIMITED', label: 'Unlimited' },
];
const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
];

export default function EmploymentContractsPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ employees: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    employeesClient.list(token).then((emps) => setOpts({ employees: emps.map((e) => ({ value: String(e.id), label: e.name })) }));
  }, [token]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'contractNumber', label: 'Contract #' },
        { name: 'employee', label: 'Employee', options: opts?.employees.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: EmploymentContractDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.contractNumber, f.contractNumber) && match(r.employeeName, f.employee) && match(statusLabel, f.status);
      },
    }),
    [opts],
  );

  if (!opts) {
    return (
      <AppShell title="Contracts">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<EmploymentContractDto>
      title="Contracts"
      description="Employment contract terms, duration, and salary per employee."
      addLabel="Contract"
      emptyLabel="No employment contracts yet."
      filterBar={filterBar}
      columns={[
        { header: 'Employee', render: (r) => r.employeeName ?? r.employeeId },
        { header: 'Contract #', render: (r) => <span className="mono">{r.contractNumber}</span> },
        { header: 'Type', render: (r) => r.contractType },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => employmentContractsClient.list(token!)}
      onCreate={(v) => employmentContractsClient.create({ ...v, employeeId: Number(v.employeeId) }, token!)}
      onUpdate={(id, v) => employmentContractsClient.update(id, { ...v, employeeId: Number(v.employeeId) }, token!)}
      onDelete={(id) => employmentContractsClient.remove(id, token!)}
      formFields={[
        { name: 'employeeId', label: 'Employee', type: 'select', options: opts.employees, required: true },
        { name: 'contractNumber', label: 'Contract number', required: true },
        { name: 'contractType', label: 'Contract type', type: 'select', options: CONTRACT_TYPES },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date' },
        { name: 'salary', label: 'Salary' },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ employeeId: '', contractNumber: '', contractType: 'FIXED_TERM', startDate: '', endDate: '', salary: '', status: 'ACTIVE' }}
      toFormValues={(r) => ({
        employeeId: String(r.employeeId),
        contractNumber: r.contractNumber,
        contractType: r.contractType,
        startDate: r.startDate?.slice(0, 10) ?? '',
        endDate: r.endDate?.slice(0, 10) ?? '',
        salary: r.salary ?? '',
        status: r.status,
      })}
    />
  );
}
