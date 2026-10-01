import * as grpc from '@grpc/grpc-js';
import { rpc } from './grpc-handler.js';
import type { Access } from './authz.js';
import type { PermissionModule } from '../common/auth/permissions.js';

export { serialize } from './grpc-handler.js';

interface CrudLike {
  // `any` here (not Record<string, unknown>) so modules with a narrower,
  // specific DTO type (CreateUserDto, CreateInvoiceDto, ...) still satisfy
  // this shape — the gRPC layer only ever forwards call.request into it.
  create(dto: any): Promise<unknown>;
  findAll(): Promise<unknown[]>;
  findOne(id: number): Promise<unknown>;
  update(id: number, dto: any): Promise<unknown>;
  remove(id: number): Promise<unknown>;
}

export interface CrudGrpcOptions {
  /** Permission-matrix module guarding this service's writes (and reads, unless `readAccess` overrides). */
  module: PermissionModule;
  /**
   * Who may List/Get. Defaults to the module's view permission. Shared
   * reference data that other modules' forms pick from (trucks, drivers,
   * customers, ...) is readable by any signed-in user, so e.g. someone
   * allowed to record trips can still fill the trip form's dropdowns.
   */
  readAccess?: 'authenticated';
  listKey?: string;
}

/**
 * Builds the standard List/Get/Create/Update/Delete gRPC handlers for a
 * CrudService-shaped module (see common/crud/crud.service.ts), each one
 * authorized against the role permission matrix.
 */
export function createCrudGrpcHandlers(service: CrudLike, opts: CrudGrpcOptions): grpc.UntypedServiceImplementation {
  const listKey = opts.listKey ?? 'items';
  const read: Access = opts.readAccess ?? { module: opts.module, action: 'view' };

  return {
    list: rpc(read, async () => ({ [listKey]: await service.findAll() }), 'read'),
    get: rpc(read, (req: { id: number }) => service.findOne(req.id), 'read'),
    create: rpc({ module: opts.module, action: 'add' }, (req) => service.create(req)),
    update: rpc({ module: opts.module, action: 'edit' }, ({ id, ...rest }: { id: number }) => service.update(id, rest)),
    delete: rpc({ module: opts.module, action: 'delete' }, async (req: { id: number }) => {
      await service.remove(req.id);
      return {};
    }, 'delete'),
  };
}
