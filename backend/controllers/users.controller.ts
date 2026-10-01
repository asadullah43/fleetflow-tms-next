import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';
import { usersService } from '../services/users.service.js';
import type { CrudController } from './crud.controller.js';

/** Update and delete also pass who is calling: an account may not deactivate or delete itself. */
export const usersController: CrudController = {
  list: ((ctx) => usersService.list(ctx.input)) as Controller<ListQuery>,
  get: (ctx) => usersService.findOne(ctx.input.id),
  create: (ctx) => usersService.create(ctx.input),
  update: (ctx) => {
    const { id, ...changes } = ctx.input;
    return usersService.update(id, changes, ctx.principal?.userId ?? null);
  },
  remove: async (ctx) => {
    await usersService.remove(ctx.input.id, ctx.principal?.userId ?? null);
    return {};
  },
};
