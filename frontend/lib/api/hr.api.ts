import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

const hr = fleetflow.hr;

export interface DepartmentDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  managerId?: number;
  status: string;
}
export const departmentsApi = createCrudApi<DepartmentDto>('departments', 'fleetflow.hr.DepartmentsService', hr, 'Department');

export interface DesignationDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  departmentId: number;
  level?: string;
  status: string;
  departmentName?: string;
}
export const designationsApi = createCrudApi<DesignationDto>('designations', 'fleetflow.hr.DesignationsService', hr, 'Designation');

export interface EmployeeDto {
  id: number;
  employeeNumber: string;
  name: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  joiningDate: string;
  employmentType: string;
  employmentStatus: string;
  departmentId: number;
  designationId?: number;
  managerId?: number;
  salary?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  driverId?: number;
  notes?: string;
  departmentName?: string;
  designationName?: string;
}
export const employeesApi = createCrudApi<EmployeeDto>('employees', 'fleetflow.hr.EmployeesService', hr, 'Employee');

export interface AttendanceDto {
  id: number;
  employeeId: number;
  attendDate: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  hoursWorked?: string;
  notes?: string;
  employeeName?: string;
}
export const attendanceApi = createCrudApi<AttendanceDto>('attendance', 'fleetflow.hr.AttendanceService', hr, 'Attendance');

export interface LeaveRequestDto {
  id: number;
  employeeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  approverId?: number;
  comments?: string;
  employeeName?: string;
}
export const leaveRequestsApi = createCrudApi<LeaveRequestDto>('leaveRequests', 'fleetflow.hr.LeaveRequestsService', hr, 'LeaveRequest');

export interface EmployeeDocumentDto {
  id: number;
  employeeId: number;
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  notes?: string;
  employeeName?: string;
}
export const employeeDocumentsApi = createCrudApi<EmployeeDocumentDto>('employeeDocuments', 'fleetflow.hr.EmployeeDocumentsService', hr, 'EmployeeDocument');

export interface EmploymentContractDto {
  id: number;
  employeeId: number;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  salary?: string;
  currency?: string;
  terms?: string;
  status: string;
  documentUrl?: string;
  title?: string;
  notes?: string;
  employeeName?: string;
}
export const employmentContractsApi = createCrudApi<EmploymentContractDto>('employmentContracts', 'fleetflow.hr.EmploymentContractsService', hr, 'EmploymentContract');
