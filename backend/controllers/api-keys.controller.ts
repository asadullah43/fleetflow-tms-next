import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';
import { apiKeysService } from '../services/api-keys.service.js';

export const apiKeysController = {
  list: ((ctx) => apiKeysService.list(ctx.input)) as Controller<ListQuery>,
  create: ((ctx) => apiKeysService.create(ctx.input, ctx.principal!)) as Controller,
  revoke: ((ctx) => apiKeysService.revoke(ctx.input.id)) as Controller<{ id: number }>,
};
