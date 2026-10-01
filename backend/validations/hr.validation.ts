import { z } from 'zod';
import { dateString, id, language, optionalDateString, optionalDecimalString, optionalId, optionalText, requiredText } from './common.validation.js';

export const createAttendanceRequest = z.object({
  employeeId: id,
  attendDate: dateString,
  checkIn: optionalDateString,
  checkOut: optionalDateString,
  status: optionalText,
  hoursWorked: optionalDecimalString,
  notes: optionalText,
});

export const createDepartmentRequest = z.object({
  name: requiredText,
  language: language.optional(),
  description: optionalText,
  managerId: optionalId,
  status: optionalText,
  nameAr: optionalText,
});

export const createDesignationRequest = z.object({
  name: requiredText,
  language: language.optional(),
  description: optionalText,
  departmentId: id,
  level: optionalText,
  status: optionalText,
  nameAr: optionalText,
});

export const createEmployeeDocumentRequest = z.object({
  employeeId: id,
  documentType: requiredText,
  documentNumber: optionalText,
  issueDate: optionalDateString,
  expiryDate: optionalDateString,
  fileUrl: optionalText,
  notes: optionalText,
});

export const createEmployeeRequest = z.object({
  name: requiredText,
  language: language.optional(),
  email: optionalText,
  phone: optionalText,
  idNumber: optionalText,
  joiningDate: dateString,
  employmentType: optionalText,
  employmentStatus: optionalText,
  departmentId: id,
  designationId: optionalId,
  managerId: optionalId,
  salary: optionalDecimalString,
  address: optionalText,
  emergencyContact: optionalText,
  emergencyPhone: optionalText,
  driverId: optionalId,
  notes: optionalText,
  nameAr: optionalText,
});

export const createEmploymentContractRequest = z.object({
  employeeId: id,
  contractNumber: requiredText,
  contractType: optionalText,
  startDate: dateString,
  endDate: optionalDateString,
  salary: optionalDecimalString,
  currency: optionalText,
  terms: optionalText,
  status: optionalText,
  documentUrl: optionalText,
  title: optionalText,
  notes: optionalText,
});

export const createLeaveRequestRequest = z.object({
  employeeId: id,
  leaveType: requiredText,
  startDate: dateString,
  endDate: dateString,
  days: z.number().int(),
  reason: optionalText,
  status: optionalText,
});

export const updateAttendanceRequest = z.object({
  id: id,
  employeeId: optionalId,
  attendDate: optionalDateString,
  checkIn: optionalDateString,
  checkOut: optionalDateString,
  status: optionalText,
  hoursWorked: optionalDecimalString,
  notes: optionalText,
});

export const updateDepartmentRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  description: optionalText,
  managerId: optionalId,
  status: optionalText,
  nameAr: optionalText,
});

export const updateDesignationRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  description: optionalText,
  departmentId: optionalId,
  level: optionalText,
  status: optionalText,
  nameAr: optionalText,
});

export const updateEmployeeDocumentRequest = z.object({
  id: id,
  employeeId: optionalId,
  documentType: optionalText,
  documentNumber: optionalText,
  issueDate: optionalDateString,
  expiryDate: optionalDateString,
  fileUrl: optionalText,
  notes: optionalText,
});

export const updateEmployeeRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  email: optionalText,
  phone: optionalText,
  idNumber: optionalText,
  joiningDate: optionalDateString,
  employmentType: optionalText,
  employmentStatus: optionalText,
  departmentId: optionalId,
  designationId: optionalId,
  managerId: optionalId,
  salary: optionalDecimalString,
  address: optionalText,
  emergencyContact: optionalText,
  emergencyPhone: optionalText,
  driverId: optionalId,
  notes: optionalText,
  nameAr: optionalText,
});

export const updateEmploymentContractRequest = z.object({
  id: id,
  employeeId: optionalId,
  contractNumber: optionalText,
  contractType: optionalText,
  startDate: optionalDateString,
  endDate: optionalDateString,
  salary: optionalDecimalString,
  currency: optionalText,
  terms: optionalText,
  status: optionalText,
  documentUrl: optionalText,
  title: optionalText,
  notes: optionalText,
});

export const updateLeaveRequestRequest = z.object({
  id: id,
  employeeId: optionalId,
  leaveType: optionalText,
  startDate: optionalDateString,
  endDate: optionalDateString,
  days: z.number().int().optional(),
  reason: optionalText,
  status: optionalText,
  approverId: optionalId,
  comments: optionalText,
});
