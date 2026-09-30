import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { rateContractsService } from './rate-contracts.service.js';

export const rateContractsGrpcImpl = createCrudGrpcHandlers(rateContractsService, { listKey: 'items' });
