import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { tripsService } from './trips.service.js';

export const tripsGrpcImpl = createCrudGrpcHandlers(tripsService, { module: 'trips' });
