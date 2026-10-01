import { rolesController } from '../controllers/roles.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { validate } from '../middlewares/validation.js';
import { listRequest } from '../validations/common.validation.js';
import { createRoleRequest, updateRoleRequest } from '../validations/roles.validation.js';
import { crudRoutes } from './crud.routes.js';
import { route, ServiceRoutes } from './router.js';

export const rolesRoutes: ServiceRoutes = {
  'fleetflow.roles.RolesService': {
    ...crudRoutes({
      type: 'fleetflow.roles.Role',
      module: 'roles',
      controller: rolesController,
      createSchema: createRoleRequest,
      updateSchema: updateRoleRequest,
    }),
    // The module list itself isn't sensitive; the Roles, Users and API-key screens all need it.
    GetPermissionModules: route('fleetflow.roles.ModuleList', 'read', authenticate, validate(listRequest), rolesController.getPermissionModules),
  },
};
