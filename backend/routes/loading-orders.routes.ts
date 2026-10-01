import { loadingOrdersController } from '../controllers/loading-orders.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize } from '../middlewares/authorization.js';
import { idempotency } from '../middlewares/idempotency.js';
import { validate } from '../middlewares/validation.js';
import { listRequest } from '../validations/common.validation.js';
import { batchRequest, createLoadingOrderRequest } from '../validations/loading-orders.validation.js';
import { route, ServiceRoutes } from './router.js';

const PKG = 'fleetflow.loadingorders';
const view = [authenticate, authorize('loadingOrders', 'view')] as const;

export const loadingOrdersRoutes: ServiceRoutes = {
  [`${PKG}.LoadingOrdersService`]: {
    ListGrouped: route(`${PKG}.LoadingOrderBatchList`, 'read', ...view, validate(listRequest), loadingOrdersController.listGrouped),
    GetBatch: route(`${PKG}.LoadingOrderList`, 'read', ...view, validate(batchRequest), loadingOrdersController.getBatch),
    GetBatchDocument: route(`${PKG}.LoadingOrderDocument`, 'read', ...view, validate(batchRequest), loadingOrdersController.getBatchDocument),
    // Idempotent: a double click on "Generate" must not issue a second run of serial numbers.
    Create: route(
      `${PKG}.LoadingOrderList`,
      'write',
      authenticate,
      authorize('loadingOrders', 'add'),
      validate(createLoadingOrderRequest),
      idempotency,
      loadingOrdersController.create,
    ),
    DeleteBatch: route('fleetflow.common.Empty', 'delete', authenticate, authorize('loadingOrders', 'delete'), validate(batchRequest), loadingOrdersController.deleteBatch),
  },
};
