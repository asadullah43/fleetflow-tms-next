/**
 * The standard route set for a list/get/create/update/delete resource,
 * with the middleware chain spelled out per operation:
 *
 *   List / Get : authenticate → authorize(view) → validate
 *   Create     : authenticate → authorize(add)  → validate → idempotency
 *   Update     : authenticate → authorize(edit) → validate
 *   Delete     : authenticate → authorize(delete) → validate
 */
import type { ZodTypeAny } from 'zod';
import type { CrudController } from '../controllers/crud.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize, authorizeLookup } from '../middlewares/authorization.js';
import { idempotency } from '../middlewares/idempotency.js';
import { validate } from '../middlewares/validation.js';
import type { PermissionModule } from '../utils/permissions.js';
import { idRequest, listRequest } from '../validations/common.validation.js';
import { route, RouteTable } from './router.js';

type Operation = 'list' | 'get' | 'create' | 'update' | 'delete';

export interface CrudRouteOptions {
  /** Fully-qualified proto type of one record, e.g. 'fleetflow.trucks.Truck'. Its list type is `<type>List`. */
  type: string;
  /** Permission-matrix module guarding this resource. */
  module: PermissionModule;
  controller: CrudController;
  createSchema?: ZodTypeAny;
  updateSchema?: ZodTypeAny;
  /** Shared reference data: any signed-in user may read it (see authorizeLookup). */
  lookup?: boolean;
  /** Defaults to all five. */
  operations?: Operation[];
}

const EMPTY = 'fleetflow.common.Empty';

export function crudRoutes(options: CrudRouteOptions): RouteTable {
  const { type, module, controller } = options;
  const operations = options.operations ?? ['list', 'get', 'create', 'update', 'delete'];
  const canRead = options.lookup ? authorizeLookup(module) : authorize(module, 'view');
  const table: RouteTable = {};

  if (operations.includes('list')) table.List = route(`${type}List`, 'read', authenticate, canRead, validate(listRequest), controller.list);
  if (operations.includes('get')) table.Get = route(type, 'read', authenticate, canRead, validate(idRequest), controller.get);
  if (operations.includes('create')) {
    if (!options.createSchema) throw new Error(`${type}: createSchema is required`);
    table.Create = route(type, 'write', authenticate, authorize(module, 'add'), validate(options.createSchema), idempotency, controller.create);
  }
  if (operations.includes('update')) {
    if (!options.updateSchema) throw new Error(`${type}: updateSchema is required`);
    table.Update = route(type, 'write', authenticate, authorize(module, 'edit'), validate(options.updateSchema), controller.update);
  }
  if (operations.includes('delete')) table.Delete = route(EMPTY, 'delete', authenticate, authorize(module, 'delete'), validate(idRequest), controller.remove);
  return table;
}
