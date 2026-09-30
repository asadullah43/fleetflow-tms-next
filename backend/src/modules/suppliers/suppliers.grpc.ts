import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { suppliersService } from './suppliers.service.js';

export const suppliersGrpcImpl = createCrudGrpcHandlers(suppliersService, { listKey: 'items' });
