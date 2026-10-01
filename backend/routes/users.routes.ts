import { usersController } from '../controllers/users.controller.js';
import { createUserRequest, updateUserRequest } from '../validations/users.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const usersRoutes: ServiceRoutes = {
  'fleetflow.users.UsersService': crudRoutes({
    type: 'fleetflow.users.User',
    module: 'users',
    controller: usersController,
    createSchema: createUserRequest,
    updateSchema: updateUserRequest,
  }),
};
