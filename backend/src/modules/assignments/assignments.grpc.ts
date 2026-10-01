import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { assignmentsService } from './assignments.service.js';

// Readable by any signed-in user: the Trips form looks up a truck's current driver from this list.
export const assignmentsGrpcImpl = createCrudGrpcHandlers(assignmentsService, { module: 'assignments', readAccess: 'authenticated' });
