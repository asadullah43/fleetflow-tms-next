import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { supplierPaymentsService } from './supplier-payments.service.js';

export const supplierPaymentsGrpcImpl = createCrudGrpcHandlers(supplierPaymentsService, { module: 'supplierPayments' });
