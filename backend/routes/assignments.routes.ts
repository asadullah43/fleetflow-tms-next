import { assignmentsController } from '../controllers/assignments.controller.js';
import { createAssignmentRequest, updateAssignmentRequest } from '../validations/assignments.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const assignmentsRoutes: ServiceRoutes = {
  'fleetflow.assignments.AssignmentsService': crudRoutes({
    type: 'fleetflow.assignments.Assignment',
    module: 'assignments',
    controller: assignmentsController,
    lookup: true,
    createSchema: createAssignmentRequest,
    updateSchema: updateAssignmentRequest,
  }),
};
