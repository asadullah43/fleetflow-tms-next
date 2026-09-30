import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { usersService } from './users.service.js';

export const usersGrpcImpl = createCrudGrpcHandlers(usersService, { listKey: 'items' });
