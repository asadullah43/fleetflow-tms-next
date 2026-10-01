/**
 * Controllers are the thin layer between a route and a service: read the
 * validated input (and, where needed, who is calling), call the service,
 * return its result. No business rules and no database access here.
 *
 * Most FleetFlow resources share the same five operations, so their
 * controllers come from this one factory.
 */
import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';

export interface CrudServiceShape {
  list(query: ListQuery): Promise<unknown>;
  findOne?(id: number): Promise<unknown>;
  create?(input: any): Promise<unknown>;
  update?(id: number, input: any): Promise<unknown>;
  remove(id: number): Promise<unknown>;
}

export interface CrudController {
  list: Controller<ListQuery>;
  get: Controller<{ id: number }>;
  create: Controller;
  update: Controller<{ id: number }>;
  remove: Controller<{ id: number }>;
}

function unsupported(): never {
  throw new Error('This resource does not support that operation');
}

export function crudController(service: CrudServiceShape): CrudController {
  return {
    list: (ctx) => service.list(ctx.input),
    get: (ctx) => (service.findOne ? service.findOne(ctx.input.id) : unsupported()),
    create: (ctx) => (service.create ? service.create(ctx.input) : unsupported()),
    update: (ctx) => {
      const { id, ...changes } = ctx.input;
      return service.update ? service.update(id, changes) : unsupported();
    },
    remove: async (ctx) => {
      await service.remove(ctx.input.id);
      return {};
    },
  };
}
