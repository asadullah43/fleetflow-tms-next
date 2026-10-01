'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { CrudPanel } from '../../components/CrudPage';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import {
  departmentsClient,
  designationsClient,
  employeesClient,
  attendanceClient,
  leaveRequestsClient,
  employeeDocumentsClient,
  employmentContractsClient,
  DepartmentDto,
  DesignationDto,
  EmployeeDto,
  AttendanceDto,
  LeaveRequestDto,
  EmployeeDocumentDto,
  EmploymentContractDto,
} from '../../lib/grpc/hr';

type Opt = { value: string; label: string }[];
const TABS = ['Departments', 'Designations', 'Employees', 'Attendance', 'Leave Requests', 'Documents', 'Contracts'] as const;

function Tabs({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            borderBottom: active === t ? '2px solid var(--accent)' : '2px solid transparent',
            borderRadius: 0,
            color: active === t ? 'var(--text)' : 'var(--text-muted)',
            padding: '8px 4px',
            marginRight: 20,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export default function HrPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Departments');
  const [opts, setOpts] = useState<{ departments: Opt; designations: Opt; employees: Opt } | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([departmentsClient.list(token), designationsClient.list(token), employeesClient.list(token)]).then(([deps, desigs, emps]) => {
      setOpts({
        departments: deps.map((d) => ({ value: String(d.id), label: d.name })),
        designations: desigs.map((d) => ({ value: String(d.id), label: d.name })),
        employees: emps.map((e) => ({ value: String(e.id), label: e.name })),
      });
    });
  }, [token, tab]);

  return (
    <AppShell title="HR">
      <Tabs active={tab} onChange={(t) => setTab(t as (typeof TABS)[number])} />

      {tab === 'Departments' && (
        <CrudPanel<DepartmentDto>
          addLabel="Department"
          emptyLabel="No departments yet."
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
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
          ]}
          emptyValues={{ name: '', language: 'en', description: '', status: 'ACTIVE' }}
          toFormValues={(r) => ({ name: r.name, language: 'en', description: r.description ?? '', status: r.status })}
        />
      )}

      {tab === 'Designations' && opts && (
        <CrudPanel<DesignationDto>
          addLabel="Designation"
          emptyLabel="No designations yet."
          columns={[
            { header: 'Name', render: (r) => r.name },
            { header: 'Department', render: (r) => r.departmentName ?? r.departmentId },
            { header: 'Level', render: (r) => r.level ?? '—' },
            { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          fetchAll={() => designationsClient.list(token!)}
          onCreate={(v) => designationsClient.create({ ...v, departmentId: Number(v.departmentId) }, token!)}
          onUpdate={(id, v) => designationsClient.update(id, { ...v, departmentId: Number(v.departmentId) }, token!)}
          onDelete={(id) => designationsClient.remove(id, token!)}
          formFields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'language', label: 'Language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic' }] },
            { name: 'departmentId', label: 'Department', type: 'select', options: opts.departments, required: true },
            { name: 'level', label: 'Level' },
            { name: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
          ]}
          emptyValues={{ name: '', language: 'en', departmentId: '', level: '', status: 'ACTIVE' }}
          toFormValues={(r) => ({ name: r.name, language: 'en', departmentId: String(r.departmentId), level: r.level ?? '', status: r.status })}
        />
      )}

      {tab === 'Employees' && opts && (
        <CrudPanel<EmployeeDto>
          addLabel="Employee"
          emptyLabel="No employees yet."
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
            {
              name: 'employmentStatus',
              label: 'Status',
              type: 'select',
              options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'ON_LEAVE', label: 'On leave' }, { value: 'TERMINATED', label: 'Terminated' }],
            },
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
      )}

      {tab === 'Attendance' && opts && (
        <CrudPanel<AttendanceDto>
          addLabel="Attendance"
          emptyLabel="No attendance records yet."
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
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [{ value: 'PRESENT', label: 'Present' }, { value: 'ABSENT', label: 'Absent' }, { value: 'LATE', label: 'Late' }, { value: 'HALF_DAY', label: 'Half day' }],
            },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyValues={{ employeeId: '', attendDate: '', status: 'PRESENT', notes: '' }}
          toFormValues={(r) => ({ employeeId: String(r.employeeId), attendDate: r.attendDate?.slice(0, 10) ?? '', status: r.status, notes: r.notes ?? '' })}
        />
      )}

      {tab === 'Leave Requests' && opts && (
        <CrudPanel<LeaveRequestDto>
          addLabel="Leave Request"
          emptyLabel="No leave requests yet."
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
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }],
            },
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
      )}

      {tab === 'Documents' && opts && (
        <CrudPanel<EmployeeDocumentDto>
          addLabel="Document"
          emptyLabel="No employee documents yet."
          columns={[
            { header: 'Employee', render: (r) => r.employeeName ?? r.employeeId },
            { header: 'Type', render: (r) => r.documentType },
            { header: 'Expiry', render: (r) => (r.expiryDate ? r.expiryDate.slice(0, 10) : '—') },
          ]}
          fetchAll={() => employeeDocumentsClient.list(token!)}
          onCreate={(v) => employeeDocumentsClient.create({ ...v, employeeId: Number(v.employeeId) }, token!)}
          onUpdate={(id, v) => employeeDocumentsClient.update(id, { ...v, employeeId: Number(v.employeeId) }, token!)}
          onDelete={(id) => employeeDocumentsClient.remove(id, token!)}
          formFields={[
            { name: 'employeeId', label: 'Employee', type: 'select', options: opts.employees, required: true },
            { name: 'documentType', label: 'Document type', required: true },
            { name: 'documentNumber', label: 'Document number' },
            { name: 'issueDate', label: 'Issue date', type: 'date' },
            { name: 'expiryDate', label: 'Expiry date', type: 'date' },
            { name: 'fileUrl', label: 'File URL' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyValues={{ employeeId: '', documentType: '', documentNumber: '', issueDate: '', expiryDate: '', fileUrl: '', notes: '' }}
          toFormValues={(r) => ({
            employeeId: String(r.employeeId),
            documentType: r.documentType,
            documentNumber: r.documentNumber ?? '',
            issueDate: r.issueDate?.slice(0, 10) ?? '',
            expiryDate: r.expiryDate?.slice(0, 10) ?? '',
            fileUrl: r.fileUrl ?? '',
            notes: r.notes ?? '',
          })}
        />
      )}

      {tab === 'Contracts' && opts && (
        <CrudPanel<EmploymentContractDto>
          addLabel="Contract"
          emptyLabel="No employment contracts yet."
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
            {
              name: 'contractType',
              label: 'Contract type',
              type: 'select',
              options: [{ value: 'FIXED_TERM', label: 'Fixed term' }, { value: 'UNLIMITED', label: 'Unlimited' }],
            },
            { name: 'startDate', label: 'Start date', type: 'date', required: true },
            { name: 'endDate', label: 'End date', type: 'date' },
            { name: 'salary', label: 'Salary' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'EXPIRED', label: 'Expired' }, { value: 'TERMINATED', label: 'Terminated' }],
            },
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
      )}
    </AppShell>
  );
}
