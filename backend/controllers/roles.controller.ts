import type { Controller } from '../middlewares/request-context.js';
import { rolesService } from '../services/roles.service.js';
import { crudController } from './crud.controller.js';

export const rolesController = {
  ...crudController(rolesService),
  getPermissionModules: (async () => rolesService.getPermissionModules()) as Controller,
};
