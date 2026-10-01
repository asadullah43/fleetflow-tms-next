import { departmentsService, designationsService, employeesService, attendanceService, leaveRequestsService, employeeDocumentsService, employmentContractsService } from '../services/hr.service.js';
import { crudController } from './crud.controller.js';

export const departmentsController = crudController(departmentsService);
export const designationsController = crudController(designationsService);
export const employeesController = crudController(employeesService);
export const attendanceController = crudController(attendanceService);
export const leaveRequestsController = crudController(leaveRequestsService);
export const employeeDocumentsController = crudController(employeeDocumentsService);
export const employmentContractsController = crudController(employmentContractsService);
