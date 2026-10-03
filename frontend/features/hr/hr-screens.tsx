'use client';

import { actions } from '../../components/action-items';
import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE, lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import {
  attendanceApi,
  AttendanceDto,
  departmentsApi,
  DepartmentDto,
  designationsApi,
  DesignationDto,
  employeeDocumentsApi,
  EmployeeDocumentDto,
  employeesApi,
  EmployeeDto,
  employmentContractsApi,
  EmploymentContractDto,
  leaveRequestsApi,
  LeaveRequestDto,
} from '../../lib/api/hr.api';
import type { FileInfoDto } from '../../lib/api/files.api';
import { formatDate, toTimeInput } from '../../lib/date';
import { localizedName } from '../../lib/localized-name';
import type { RowAction } from '../crud/types';
import { useFileOpener } from '../files/use-files';
import { attendanceTimes, deriveAttendance } from './attendance-times';
import { useLeaveDecisions } from './use-leave-decisions';

const employeeFilter = { name: 'employeeId', label: 'Employee', type: 'lookup', lookup: lookups.employees } as const;
const employeeField = { name: 'employeeId', label: 'Employee', type: 'lookup', lookup: lookups.employees, required: true } as const;

// ── Departments ─────────────────────────────────────────────────────────
const departments: CrudDefinition<DepartmentDto> = {
  api: departmentsApi,
  title: 'Departments',
  description: 'Organizational departments used across employee records.',
  addLabel: 'Department',
  searchPlaceholder: 'Department name',
  emptyLabel: 'No departments yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Description', value: (r) => r.description },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};
export const DepartmentsScreen = () => <CrudScreen definition={departments} />;

// ── Designations ────────────────────────────────────────────────────────
const designations: CrudDefinition<DesignationDto> = {
  api: designationsApi,
  title: 'Designations',
  description: 'Job titles and levels, grouped by department.',
  addLabel: 'Designation',
  searchPlaceholder: 'Designation or department',
  emptyLabel: 'No designations yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Department', value: (r) => r.departmentName, sortKey: 'departmentName' },
    { header: 'Level', value: (r) => r.level },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [
    { name: 'departmentId', label: 'Department', type: 'lookup', lookup: lookups.departments },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE },
  ],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'departmentId', label: 'Department', type: 'lookup', lookup: lookups.departments, required: true },
    { name: 'level', label: 'Level' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};
export const DesignationsScreen = () => <CrudScreen definition={designations} />;

// ── Employees ───────────────────────────────────────────────────────────
const EMPLOYMENT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'TERMINATED', label: 'Terminated' },
];
const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
];

const employees: CrudDefinition<EmployeeDto> = {
  api: employeesApi,
  title: 'Employees',
  description: 'Employee roster with department, designation, and employment status.',
  addLabel: 'Employee',
  searchPlaceholder: 'Name, employee # or department',
  emptyLabel: 'No employees yet.',
  columns: [
    { header: 'Employee #', value: (r) => r.employeeNumber, kind: 'mono', sortKey: 'employeeNumber' },
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Department', value: (r) => r.departmentName },
    { header: 'Joining date', value: (r) => formatDate(r.joiningDate), kind: 'mono', sortKey: 'joiningDate' },
    { header: 'Status', value: (r) => r.employmentStatus, kind: 'status', sortKey: 'employmentStatus' },
  ],
  filters: [
    { name: 'departmentId', label: 'Department', type: 'lookup', lookup: lookups.departments },
    { name: 'employmentStatus', label: 'Status', type: 'select', options: EMPLOYMENT_STATUSES },
  ],
  fields: [
    { name: 'name', label: 'Full name (English)', required: true },
    { name: 'nameAr', label: 'Full name (Arabic)' },
    { name: 'email', label: 'Email' },
    { name: 'phone', label: 'Phone' },
    { name: 'joiningDate', label: 'Joining date', type: 'date', required: true },
    { name: 'departmentId', label: 'Department', type: 'lookup', lookup: lookups.departments, required: true },
    { name: 'designationId', label: 'Designation', type: 'lookup', lookup: lookups.designations },
    { name: 'employmentType', label: 'Employment type', type: 'select', options: EMPLOYMENT_TYPES, default: 'FULL_TIME', required: true },
    { name: 'employmentStatus', label: 'Status', type: 'select', options: EMPLOYMENT_STATUSES, default: 'ACTIVE', required: true },
  ],
};
export const EmployeesScreen = () => <CrudScreen definition={employees} />;

// ── Attendance ──────────────────────────────────────────────────────────
const ATTENDANCE_STATUSES = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half day' },
];

const attendance: CrudDefinition<AttendanceDto> = {
  api: attendanceApi,
  title: 'Attendance',
  description: 'Daily attendance records per employee.',
  addLabel: 'Attendance',
  searchPlaceholder: 'Employee name',
  emptyLabel: 'No attendance records yet.',
  columns: [
    { header: 'Employee', value: (r) => r.employeeName, sortKey: 'employeeName' },
    { header: 'Date', value: (r) => formatDate(r.attendDate), kind: 'mono', sortKey: 'attendDate' },
    { header: 'Time in', value: (r) => toTimeInput(r.checkIn), kind: 'mono' },
    { header: 'Time out', value: (r) => toTimeInput(r.checkOut), kind: 'mono' },
    { header: 'Hours', value: (r) => r.hoursWorked, kind: 'mono', align: 'right' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
    { header: 'Notes', value: (r) => r.notes },
  ],
  filters: [employeeFilter, { name: 'status', label: 'Status', type: 'select', options: ATTENDANCE_STATUSES }, { name: 'fromDate', label: 'From Date', type: 'date' }, { name: 'toDate', label: 'To Date', type: 'date' }],
  fields: [
    employeeField,
    { name: 'attendDate', label: 'Date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ATTENDANCE_STATUSES, default: 'PRESENT', required: true },
    { name: 'checkIn', label: 'Time in', type: 'time' },
    { name: 'checkOut', label: 'Time out', type: 'time', hint: 'Earlier than time in = the next morning (night shift).' },
    { name: 'hoursWorked', label: 'Hours worked', type: 'decimal', hint: 'Worked out from time in and time out; you can type a different number.' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  // Times of day on the attendance date -> timestamps. '' clears a time when editing.
  toApi: (payload, values) => ({ ...payload, ...attendanceTimes(values.attendDate, values.checkIn, values.checkOut) }),
  derive: deriveAttendance,
};
export const AttendanceScreen = () => <CrudScreen definition={attendance} />;

// ── Leave requests ──────────────────────────────────────────────────────
const LEAVE_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const leaveRequests: CrudDefinition<LeaveRequestDto> = {
  api: leaveRequestsApi,
  title: 'Leave Requests',
  description: 'Employee leave requests and their approval status. Filing a request and approving it are separate permissions (Roles → Leave requests: Add / Edit).',
  addLabel: 'Leave Request',
  searchPlaceholder: 'Employee or leave type',
  emptyLabel: 'No leave requests yet.',
  columns: [
    { header: 'Employee', value: (r) => r.employeeName, sortKey: 'employeeName' },
    { header: 'Type', value: (r) => r.leaveType },
    { header: 'From', value: (r) => formatDate(r.startDate), kind: 'mono', sortKey: 'startDate' },
    { header: 'To', value: (r) => formatDate(r.endDate), kind: 'mono', sortKey: 'endDate' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [employeeFilter, { name: 'status', label: 'Status', type: 'select', options: LEAVE_STATUSES }],
  fields: [
    employeeField,
    { name: 'leaveType', label: 'Leave type', required: true },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date', required: true },
    { name: 'days', label: 'Number of days', type: 'integer', required: true },
    { name: 'reason', label: 'Reason', type: 'textarea' },
    // A new request is always Pending; deciding it is an edit (Approve / Reject in the row menu, or here).
    { name: 'status', label: 'Status', type: 'select', options: LEAVE_STATUSES, default: 'PENDING', required: true, editOnly: true },
  ],
};
export function LeaveRequestsScreen() {
  const { decide, decidingId } = useLeaveDecisions();
  const decision =
    (status: 'APPROVED' | 'REJECTED'): RowAction<LeaveRequestDto> =>
    (row, { allowed }) =>
      (status === 'APPROVED' ? actions.approve : actions.reject)(() => void decide(row, status), { hidden: !allowed.edit || row.status !== 'PENDING', loading: decidingId === row.id });
  return <CrudScreen definition={leaveRequests} rowActions={[decision('APPROVED'), decision('REJECTED')]} />;
}

// ── Attached files: open / download from the row ────────────────────────
/** "Open file" (kept visible on the row) and "Download file", for a row's attached file; a legacy typed-in link opens as it is. */
function fileRowActions<T>(fileOf: (row: T) => FileInfoDto | undefined, legacyUrlOf: (row: T) => string | undefined, opener: ReturnType<typeof useFileOpener>): RowAction<T>[] {
  const legacy = (row: T) => {
    const url = legacyUrlOf(row);
    return !fileOf(row) && url && /^https?:\/\//i.test(url) ? url : undefined;
  };
  return [
    (row) => {
      const file = fileOf(row);
      const link = legacy(row);
      return actions.openFile(() => (file ? opener.open(file.id) : link && window.open(link, '_blank', 'noopener')), { hidden: !file && !link });
    },
    (row) => {
      const file = fileOf(row);
      return actions.downloadFile(() => file && opener.download(file.id), { hidden: !file });
    },
  ];
}

const fileColumn = <T,>(fileOf: (row: T) => FileInfoDto | undefined, legacyUrlOf: (row: T) => string | undefined) => ({
  header: 'File',
  value: (row: T, { t }: { t: (text: string) => string }) => fileOf(row)?.name ?? (legacyUrlOf(row) ? t('Link') : ''),
});

// ── Employee documents ──────────────────────────────────────────────────
const documents: CrudDefinition<EmployeeDocumentDto> = {
  api: employeeDocumentsApi,
  title: 'Documents',
  description: 'Employee identification and compliance documents, with expiry tracking.',
  addLabel: 'Document',
  searchPlaceholder: 'Employee, type or number',
  emptyLabel: 'No employee documents yet.',
  columns: [
    { header: 'Employee', value: (r) => r.employeeName, sortKey: 'employeeName' },
    { header: 'Type', value: (r) => r.documentType, sortKey: 'documentType' },
    { header: 'Document number', value: (r) => r.documentNumber, kind: 'mono' },
    { header: 'Expiry', value: (r) => formatDate(r.expiryDate), kind: 'mono', sortKey: 'expiryDate' },
    fileColumn<EmployeeDocumentDto>((r) => r.file, (r) => r.fileUrl),
  ],
  filters: [employeeFilter],
  fields: [
    employeeField,
    { name: 'documentType', label: 'Document type', required: true },
    { name: 'documentNumber', label: 'Document number' },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry date', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'fileId', label: 'File', type: 'file', purpose: 'EMPLOYEE_DOCUMENT', fileFrom: 'file', hint: 'The scan or PDF of the document.' },
  ],
};
export function EmployeeDocumentsScreen() {
  const opener = useFileOpener();
  return <CrudScreen definition={documents} rowActions={fileRowActions<EmployeeDocumentDto>((r) => r.file, (r) => r.fileUrl, opener)} />;
}

// ── Employment contracts ────────────────────────────────────────────────
const CONTRACT_TYPES = [
  { value: 'FIXED_TERM', label: 'Fixed term' },
  { value: 'UNLIMITED', label: 'Unlimited' },
];
const CONTRACT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const contracts: CrudDefinition<EmploymentContractDto> = {
  api: employmentContractsApi,
  title: 'Contracts',
  description: 'Employment contract terms, duration, and salary per employee.',
  addLabel: 'Contract',
  searchPlaceholder: 'Employee or contract #',
  emptyLabel: 'No employment contracts yet.',
  columns: [
    { header: 'Employee', value: (r) => r.employeeName, sortKey: 'employeeName' },
    { header: 'Contract #', value: (r) => r.contractNumber, kind: 'mono' },
    { header: 'Type', value: (r, { t }) => t(CONTRACT_TYPES.find((type) => type.value === r.contractType)?.label ?? r.contractType) },
    { header: 'End date', value: (r) => formatDate(r.endDate), kind: 'mono', sortKey: 'endDate' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
    fileColumn<EmploymentContractDto>((r) => r.documentFile, (r) => r.documentUrl),
  ],
  filters: [employeeFilter, { name: 'status', label: 'Status', type: 'select', options: CONTRACT_STATUSES }],
  fields: [
    employeeField,
    { name: 'contractNumber', label: 'Contract number', required: true },
    { name: 'contractType', label: 'Contract type', type: 'select', options: CONTRACT_TYPES, default: 'FIXED_TERM', required: true },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'endDate', label: 'End date', type: 'date' },
    { name: 'salary', label: 'Salary', type: 'decimal' },
    { name: 'status', label: 'Status', type: 'select', options: CONTRACT_STATUSES, default: 'ACTIVE', required: true },
    { name: 'documentFileId', label: 'Contract document', type: 'file', purpose: 'CONTRACT_DOCUMENT', fileFrom: 'documentFile', hint: 'The signed contract (PDF or a scan).' },
  ],
};
export function EmploymentContractsScreen() {
  const opener = useFileOpener();
  return <CrudScreen definition={contracts} rowActions={fileRowActions<EmploymentContractDto>((r) => r.documentFile, (r) => r.documentUrl, opener)} />;
}
