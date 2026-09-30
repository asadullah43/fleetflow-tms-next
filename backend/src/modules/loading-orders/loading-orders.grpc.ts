import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { loadingOrdersService } from './loading-orders.service.js';

export const loadingOrdersGrpcImpl = createCrudGrpcHandlers(loadingOrdersService, { listKey: 'items' });
