import { departmentsController, designationsController, employeesController, attendanceController, leaveRequestsController, employeeDocumentsController, employmentContractsController } from '../controllers/hr.controller.js';
import { createAttendanceRequest, createDepartmentRequest, createDesignationRequest, createEmployeeDocumentRequest, createEmployeeRequest, createEmploymentContractRequest, createLeaveRequestRequest, updateAttendanceRequest, updateDepartmentRequest, updateDesignationRequest, updateEmployeeDocumentRequest, updateEmployeeRequest, updateEmploymentContractRequest, updateLeaveRequestRequest } from '../validations/hr.validation.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorizeAny } from '../middlewares/authorization.js';
import { validate } from '../middlewares/validation.js';
import { idRequest, listRequest } from '../validations/common.validation.js';
import { crudRoutes } from './crud.routes.js';
import { route, ServiceRoutes } from './router.js';

const employeesCrud = crudRoutes({
  type: 'fleetflow.hr.Employee',
  module: 'hr',
  controller: employeesController,
  createSchema: createEmployeeRequest,
  updateSchema: updateEmployeeRequest,
});

export const hrRoutes: ServiceRoutes = {
  'fleetflow.hr.DepartmentsService': crudRoutes({
    type: 'fleetflow.hr.Department',
    module: 'hr',
    controller: departmentsController,
    createSchema: createDepartmentRequest,
    updateSchema: updateDepartmentRequest,
  }),
  'fleetflow.hr.DesignationsService': crudRoutes({
    type: 'fleetflow.hr.Designation',
    module: 'hr',
    controller: designationsController,
    createSchema: createDesignationRequest,
    updateSchema: updateDesignationRequest,
  }),
  'fleetflow.hr.EmployeesService': {
    ...employeesCrud,
    // Also readable by whoever handles leave (to pick the employee on a request) — names only unless they have HR view.
    List: route('fleetflow.hr.EmployeeList', 'read', authenticate, authorizeAny(['hr', 'leaveRequests'], 'view'), validate(listRequest), employeesController.list),
    Get: route('fleetflow.hr.Employee', 'read', authenticate, authorizeAny(['hr', 'leaveRequests'], 'view'), validate(idRequest), employeesController.get),
  },
  'fleetflow.hr.AttendanceService': crudRoutes({
    type: 'fleetflow.hr.Attendance',
    module: 'hr',
    controller: attendanceController,
    createSchema: createAttendanceRequest,
    updateSchema: updateAttendanceRequest,
  }),
  // Its own module: add = apply for leave, edit = approve / reject (see utils/permissions.ts).
  'fleetflow.hr.LeaveRequestsService': crudRoutes({
    type: 'fleetflow.hr.LeaveRequest',
    module: 'leaveRequests',
    controller: leaveRequestsController,
    createSchema: createLeaveRequestRequest,
    updateSchema: updateLeaveRequestRequest,
  }),
  'fleetflow.hr.EmployeeDocumentsService': crudRoutes({
    type: 'fleetflow.hr.EmployeeDocument',
    module: 'hr',
    controller: employeeDocumentsController,
    createSchema: createEmployeeDocumentRequest,
    updateSchema: updateEmployeeDocumentRequest,
  }),
  'fleetflow.hr.EmploymentContractsService': crudRoutes({
    type: 'fleetflow.hr.EmploymentContract',
    module: 'hr',
    controller: employmentContractsController,
    createSchema: createEmploymentContractRequest,
    updateSchema: updateEmploymentContractRequest,
  }),
};
