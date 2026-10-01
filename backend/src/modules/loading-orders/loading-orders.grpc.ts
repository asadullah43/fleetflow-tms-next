import { rpc } from '../../lib/grpc-handler.js';
import { loadingOrdersService } from './loading-orders.service.js';

export const loadingOrdersGrpcImpl = {
  listGrouped: rpc({ module: 'loadingOrders', action: 'view' }, async () => ({ items: await loadingOrdersService.findAllGrouped() }), 'read'),
  getBatch: rpc(
    { module: 'loadingOrders', action: 'view' },
    async (req: { batchId: number }) => ({ items: await loadingOrdersService.findByBatch(req.batchId) }),
    'read',
  ),
  create: rpc({ module: 'loadingOrders', action: 'add' }, async (req: any) => ({ items: await loadingOrdersService.create(req) })),
  deleteBatch: rpc(
    { module: 'loadingOrders', action: 'delete' },
    async (req: { batchId: number }) => {
      await loadingOrdersService.removeBatch(req.batchId);
      return {};
    },
    'delete',
  ),
};
