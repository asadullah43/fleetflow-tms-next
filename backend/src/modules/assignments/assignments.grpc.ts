import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { assignmentsService } from './assignments.service.js';

export const assignmentsGrpcImpl = createCrudGrpcHandlers(assignmentsService, { listKey: 'items' });
