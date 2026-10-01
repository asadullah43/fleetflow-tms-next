import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { customersService } from './customers.service.js';

export const customersGrpcImpl = createCrudGrpcHandlers(customersService, { module: 'customers', readAccess: 'authenticated' });
