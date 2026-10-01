import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { rpc } from '../../lib/grpc-handler.js';
import { usersService } from './users.service.js';

const base = createCrudGrpcHandlers(usersService, { module: 'users' });

/**
 * Same CRUD surface as every other module, except update/delete know who
 * is calling so an administrator can't lock themselves out by
 * deactivating or deleting their own account.
 */
export const usersGrpcImpl = {
  ...base,
  update: rpc({ module: 'users', action: 'edit' }, ({ id, ...rest }: { id: number }, principal) =>
    usersService.update(id, rest, principal?.userId),
  ),
  delete: rpc(
    { module: 'users', action: 'delete' },
    async (req: { id: number }, principal) => {
      await usersService.remove(req.id, principal?.userId);
      return {};
    },
    'delete',
  ),
};
