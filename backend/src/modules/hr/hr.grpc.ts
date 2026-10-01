import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import {
  departmentsService,
  designationsService,
  employeesService,
  attendanceService,
  leaveRequestsService,
  employeeDocumentsService,
  employmentContractsService,
} from './hr.services.js';

// Every HR table is guarded by the single `hr` permission row (employee
// records carry salary and ID numbers, so even reads need hr:view).
export const departmentsGrpcImpl = createCrudGrpcHandlers(departmentsService, { module: 'hr' });
export const designationsGrpcImpl = createCrudGrpcHandlers(designationsService, { module: 'hr' });
export const employeesGrpcImpl = createCrudGrpcHandlers(employeesService, { module: 'hr' });
export const attendanceGrpcImpl = createCrudGrpcHandlers(attendanceService, { module: 'hr' });
export const leaveRequestsGrpcImpl = createCrudGrpcHandlers(leaveRequestsService, { module: 'hr' });
export const employeeDocumentsGrpcImpl = createCrudGrpcHandlers(employeeDocumentsService, { module: 'hr' });
export const employmentContractsGrpcImpl = createCrudGrpcHandlers(employmentContractsService, { module: 'hr' });
