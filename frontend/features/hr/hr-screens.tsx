'use client';

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
import { formatDate } from '../../lib/date';
import { localizedName } from '../../lib/localized-name';

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
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
    { header: 'Notes', value: (r) => r.notes },
  ],
  filters: [employeeFilter, { name: 'status', label: 'Status', type: 'select', options: ATTENDANCE_STATUSES }, { name: 'fromDate', label: 'From Date', type: 'date' }, { name: 'toDate', label: 'To Date', type: 'date' }],
  fields: [
    employeeField,
    { name: 'attendDate', label: 'Date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ATTENDANCE_STATUSES, default: 'PRESENT', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
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
  description: 'Employee leave requests and their approval status.',
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
    { name: 'status', label: 'Status', type: 'select', options: LEAVE_STATUSES, default: 'PENDING', required: true },
  ],
};
export const LeaveRequestsScreen = () => <CrudScreen definition={leaveRequests} />;

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
  ],
  filters: [employeeFilter],
  fields: [
    employeeField,
    { name: 'documentType', label: 'Document type', required: true },
    { name: 'documentNumber', label: 'Document number' },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry date', type: 'date' },
    { name: 'fileUrl', label: 'File URL' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};
export const EmployeeDocumentsScreen = () => <CrudScreen definition={documents} />;

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
  ],
};
export const EmploymentContractsScreen = () => <CrudScreen definition={contracts} />;
