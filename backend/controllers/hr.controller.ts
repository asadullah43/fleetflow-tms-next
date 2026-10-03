import { departmentsService, designationsService, employeesService, attendanceService, leaveRequestsService, employeeDocumentsService, employmentContractsService } from '../services/hr.service.js';
import { principalCan } from '../utils/permissions.js';
import { crudController, CrudController } from './crud.controller.js';

export const departmentsController = crudController(departmentsService);
export const designationsController = crudController(designationsService);
const employeesCrud = crudController(employeesService);
/** HR sees whole employee records; someone who only handles leave sees just enough to pick one (see employeePickerView). */
export const employeesController = {
  ...employeesCrud,
  list: (ctx) => (principalCan(ctx.principal!, 'hr', 'view') ? employeesCrud.list(ctx) : employeesService.listForPicker(ctx.input)),
  get: (ctx) => (principalCan(ctx.principal!, 'hr', 'view') ? employeesCrud.get(ctx) : employeesService.findOneForPicker(ctx.input.id)),
} satisfies CrudController;
export const attendanceController = crudController(attendanceService);
export const leaveRequestsController = {
  ...crudController(leaveRequestsService),
  // Filing needs "add"; whether the caller may also decide (set Approved / Rejected) is the "edit" grant.
  create: (ctx) => leaveRequestsService.create(ctx.input, { canDecide: principalCan(ctx.principal!, 'leaveRequests', 'edit') }),
} satisfies CrudController;
export const employeeDocumentsController = crudController(employeeDocumentsService);
export const employmentContractsController = crudController(employmentContractsService);
