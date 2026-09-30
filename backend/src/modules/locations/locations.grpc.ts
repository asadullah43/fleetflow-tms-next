import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { locationsService } from './locations.service.js';

export const locationsGrpcImpl = createCrudGrpcHandlers(locationsService, { listKey: 'items' });
