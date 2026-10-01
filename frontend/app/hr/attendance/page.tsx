'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAuth } from '../../../lib/auth-context';
import { useLanguage } from '../../../lib/language-context';
import { localizedName } from '../../../lib/localized-name';
import { employeesClient, attendanceClient, AttendanceDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

const STATUSES = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half day' },
];

export default function AttendancePage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const [opts, setOpts] = useState<{ employees: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    employeesClient.list(token).then((emps) => setOpts({ employees: emps.map((e) => ({ value: String(e.id), label: localizedName(e, language) })) }));
  }, [token, language]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'fromDate', label: 'From Date', type: 'date' as const },
        { name: 'toDate', label: 'To Date', type: 'date' as const },
        { name: 'employee', label: 'Employee', options: opts?.employees.map((o) => o.label) ?? [] },
        { name: 'status', label: 'Status', options: STATUSES.map((s) => s.label) },
      ],
      apply: (r: AttendanceDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        const statusLabel = STATUSES.find((s) => s.value === r.status)?.label ?? r.status;
        const date = r.attendDate?.slice(0, 10) ?? '';
        if (f.fromDate && date < f.fromDate) return false;
        if (f.toDate && date > f.toDate) return false;
        return match(r.employeeName, f.employee) && match(statusLabel, f.status);
      },
    }),
    [opts],
  );

  if (!opts) {
    return (
      <AppShell title="Attendance">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<AttendanceDto>
      title="Attendance"
      description="Daily attendance records per employee."
      addLabel="Attendance"
      emptyLabel="No attendance records yet."
      filterBar={filterBar}
      columns={[
        { header: 'Employee', render: (r) => r.employeeName ?? r.employeeId },
        { header: 'Date', render: (r) => r.attendDate?.slice(0, 10) },
        { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fetchAll={() => attendanceClient.list(token!)}
      onCreate={(v) => attendanceClient.create({ ...v, employeeId: Number(v.employeeId) }, token!)}
      onUpdate={(id, v) => attendanceClient.update(id, { ...v, employeeId: Number(v.employeeId) }, token!)}
      onDelete={(id) => attendanceClient.remove(id, token!)}
      formFields={[
        { name: 'employeeId', label: 'Employee', type: 'select', options: opts.employees, required: true },
        { name: 'attendDate', label: 'Date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'select', options: STATUSES },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyValues={{ employeeId: '', attendDate: '', status: 'PRESENT', notes: '' }}
      toFormValues={(r) => ({ employeeId: String(r.employeeId), attendDate: r.attendDate?.slice(0, 10) ?? '', status: r.status, notes: r.notes ?? '' })}
    />
  );
}
