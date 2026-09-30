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

export const departmentsGrpcImpl = createCrudGrpcHandlers(departmentsService, { listKey: 'items' });
export const designationsGrpcImpl = createCrudGrpcHandlers(designationsService, { listKey: 'items' });
export const employeesGrpcImpl = createCrudGrpcHandlers(employeesService, { listKey: 'items' });
export const attendanceGrpcImpl = createCrudGrpcHandlers(attendanceService, { listKey: 'items' });
export const leaveRequestsGrpcImpl = createCrudGrpcHandlers(leaveRequestsService, { listKey: 'items' });
export const employeeDocumentsGrpcImpl = createCrudGrpcHandlers(employeeDocumentsService, { listKey: 'items' });
export const employmentContractsGrpcImpl = createCrudGrpcHandlers(employmentContractsService, { listKey: 'items' });
