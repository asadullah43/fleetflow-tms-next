import { departmentsController, designationsController, employeesController, attendanceController, leaveRequestsController, employeeDocumentsController, employmentContractsController } from '../controllers/hr.controller.js';
import { createAttendanceRequest, createDepartmentRequest, createDesignationRequest, createEmployeeDocumentRequest, createEmployeeRequest, createEmploymentContractRequest, createLeaveRequestRequest, updateAttendanceRequest, updateDepartmentRequest, updateDesignationRequest, updateEmployeeDocumentRequest, updateEmployeeRequest, updateEmploymentContractRequest, updateLeaveRequestRequest } from '../validations/hr.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

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
  'fleetflow.hr.EmployeesService': crudRoutes({
    type: 'fleetflow.hr.Employee',
    module: 'hr',
    controller: employeesController,
    createSchema: createEmployeeRequest,
    updateSchema: updateEmployeeRequest,
  }),
  'fleetflow.hr.AttendanceService': crudRoutes({
    type: 'fleetflow.hr.Attendance',
    module: 'hr',
    controller: attendanceController,
    createSchema: createAttendanceRequest,
    updateSchema: updateAttendanceRequest,
  }),
  'fleetflow.hr.LeaveRequestsService': crudRoutes({
    type: 'fleetflow.hr.LeaveRequest',
    module: 'hr',
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
