import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const hr = fleetflow.hr;

export interface DepartmentDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  managerId?: number;
  status: string;
}
export const departmentsClient = createCrudClient<DepartmentDto>('fleetflow.hr.DepartmentsService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.DepartmentList,
  Item: hr.Department,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateDepartmentRequest,
  UpdateRequest: hr.UpdateDepartmentRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const designationsClient = createCrudClient<DesignationDto>('fleetflow.hr.DesignationsService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.DesignationList,
  Item: hr.Designation,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateDesignationRequest,
  UpdateRequest: hr.UpdateDesignationRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const employeesClient = createCrudClient<EmployeeDto>('fleetflow.hr.EmployeesService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.EmployeeList,
  Item: hr.Employee,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateEmployeeRequest,
  UpdateRequest: hr.UpdateEmployeeRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const attendanceClient = createCrudClient<AttendanceDto>('fleetflow.hr.AttendanceService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.AttendanceList,
  Item: hr.Attendance,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateAttendanceRequest,
  UpdateRequest: hr.UpdateAttendanceRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const leaveRequestsClient = createCrudClient<LeaveRequestDto>('fleetflow.hr.LeaveRequestsService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.LeaveRequestList,
  Item: hr.LeaveRequest,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateLeaveRequestRequest,
  UpdateRequest: hr.UpdateLeaveRequestRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const employeeDocumentsClient = createCrudClient<EmployeeDocumentDto>('fleetflow.hr.EmployeeDocumentsService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.EmployeeDocumentList,
  Item: hr.EmployeeDocument,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateEmployeeDocumentRequest,
  UpdateRequest: hr.UpdateEmployeeDocumentRequest,
  DeleteResponse: hr.DeleteResponse,
});

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
export const employmentContractsClient = createCrudClient<EmploymentContractDto>('fleetflow.hr.EmploymentContractsService', {
  ListRequest: hr.ListRequest,
  ItemList: hr.EmploymentContractList,
  Item: hr.EmploymentContract,
  IdRequest: hr.IdRequest,
  CreateRequest: hr.CreateEmploymentContractRequest,
  UpdateRequest: hr.UpdateEmploymentContractRequest,
  DeleteResponse: hr.DeleteResponse,
});
