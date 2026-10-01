import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { trucksService } from './trucks.service.js';

export const trucksGrpcImpl = createCrudGrpcHandlers(trucksService, { module: 'trucks', readAccess: 'authenticated' });
