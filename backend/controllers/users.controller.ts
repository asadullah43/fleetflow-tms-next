import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';
import { usersService } from '../services/users.service.js';
import { isAdminRole } from '../utils/permissions.js';
import type { CrudController } from './crud.controller.js';

/** Who is calling matters here: an account may not deactivate or delete itself, and only an administrator may grant ADMIN. */
export const usersController: CrudController = {
  list: ((ctx) => usersService.list(ctx.input)) as Controller<ListQuery>,
  get: (ctx) => usersService.findOne(ctx.input.id),
  create: (ctx) => usersService.create(ctx.input, isAdminRole(ctx.principal?.roleName)),
  update: (ctx) => {
    const { id, ...changes } = ctx.input;
    return usersService.update(id, changes, ctx.principal?.userId ?? null, isAdminRole(ctx.principal?.roleName));
  },
  remove: async (ctx) => {
    await usersService.remove(ctx.input.id, ctx.principal?.userId ?? null, isAdminRole(ctx.principal?.roleName));
    return {};
  },
};
