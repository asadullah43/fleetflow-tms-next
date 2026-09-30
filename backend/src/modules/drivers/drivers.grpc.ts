import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { driversService } from './drivers.service.js';

export const driversGrpcImpl = createCrudGrpcHandlers(driversService, { listKey: 'items' });
