import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { rpc } from '../../lib/grpc-handler.js';
import { invoicesService } from './invoices.service.js';

const base = createCrudGrpcHandlers(invoicesService, { module: 'invoices' });

export const invoicesGrpcImpl = {
  ...base,
  markPaid: rpc({ module: 'invoices', action: 'edit' }, (req: { id: number }) => invoicesService.markPaid(req.id)),
  submitToZatca: rpc({ module: 'invoices', action: 'edit' }, (req: { id: number }) => invoicesService.submitToZatca(req.id)),
};
