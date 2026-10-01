'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { employeesClient, leaveRequestsClient, LeaveRequestDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function LeaveRequestsPage() {
  const { token } = useAuth();
  const [opts, setOpts] = useState<{ employees: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    employeesClient.list(token).then((emps) => setOpts({ employees: emps.map((e) => ({ value: String(e.id), label: e.name })) }));
  }, [token]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'employee', label: 'Employee', options: opts?.employees.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: LeaveRequestDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        return match(r.employeeName, f.employee) && match(statusLabel, f.status);
      },
    }),
    [opts],
  );

  if (!opts) {
    return (
      <AppShell title="Leave Requests">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<LeaveRequestDto>
      title="Leave Requests"
      description="Employee leave requests and their approval status."
      addLabel="Leave Request"
      emptyLabel="No leave requests yet."
      filterBar={filterBar}
      columns={[
        { header: 'Employee', render: (r) => r.employeeName ?? r.employeeId },
        { header: 'Type', render: (r) => r.leaveType },
        { header: 'From', render: (r) => r.startDate?.slice(0, 10) },
        { header: 'To', render: (r) => r.endDate?.slice(0, 10) },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => leaveRequestsClient.list(token!)}
      onCreate={(v) => leaveRequestsClient.create({ ...v, employeeId: Number(v.employeeId), days: Number(v.days) }, token!)}
      onUpdate={(id, v) => leaveRequestsClient.update(id, { ...v, employeeId: Number(v.employeeId), days: Number(v.days) }, token!)}
      onDelete={(id) => leaveRequestsClient.remove(id, token!)}
      formFields={[
        { name: 'employeeId', label: 'Employee', type: 'select', options: opts.employees, required: true },
        { name: 'leaveType', label: 'Leave type', required: true },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'days', label: 'Number of days', required: true },
        { name: 'reason', label: 'Reason', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      ]}
      emptyValues={{ employeeId: '', leaveType: '', startDate: '', endDate: '', days: '', reason: '', status: 'PENDING' }}
      toFormValues={(r) => ({
        employeeId: String(r.employeeId),
        leaveType: r.leaveType,
        startDate: r.startDate?.slice(0, 10) ?? '',
        endDate: r.endDate?.slice(0, 10) ?? '',
        days: String(r.days),
        reason: r.reason ?? '',
        status: r.status,
      })}
    />
  );
}
