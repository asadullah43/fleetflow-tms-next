import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { rpc } from '../../lib/grpc-handler.js';
import { rolesService } from './roles.service.js';

export const rolesGrpcImpl = {
  ...createCrudGrpcHandlers(rolesService, { module: 'roles' }),
  // The module list itself isn't sensitive; the Roles and Users pages both need it.
  getPermissionModules: rpc('authenticated', async () => ({ modules: rolesService.getPermissionModules() }), 'read'),
};
