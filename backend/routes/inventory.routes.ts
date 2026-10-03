import { inventoryItemsController, inventoryStockController, inventoryTransactionsController, warehousesController } from '../controllers/inventory.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize, authorizeLookup } from '../middlewares/authorization.js';
import { idempotency } from '../middlewares/idempotency.js';
import { validate } from '../middlewares/validation.js';
import { listRequest } from '../validations/common.validation.js';
import { createInventoryItemRequest, createWarehouseRequest, stockInRequest, stockOutRequest, updateInventoryItemRequest, updateWarehouseRequest } from '../validations/inventory.validation.js';
import { crudRoutes } from './crud.routes.js';
import { route, ServiceRoutes } from './router.js';

const PKG = 'fleetflow.inventory';

export const inventoryRoutes: ServiceRoutes = {
  // Warehouses, items and stock levels are reference data other forms pick from (a work order's
  // "inventory used"), so any signed-in user may read them — like trucks or drivers (authorizeLookup).
  [`${PKG}.WarehousesService`]: crudRoutes({
    type: `${PKG}.Warehouse`,
    module: 'inventory',
    controller: warehousesController,
    createSchema: createWarehouseRequest,
    updateSchema: updateWarehouseRequest,
    lookup: true,
  }),
  [`${PKG}.InventoryItemsService`]: crudRoutes({
    type: `${PKG}.InventoryItem`,
    module: 'inventory',
    controller: inventoryItemsController,
    createSchema: createInventoryItemRequest,
    updateSchema: updateInventoryItemRequest,
    lookup: true,
  }),
  [`${PKG}.InventoryStockService`]: {
    List: route(`${PKG}.StockLevelList`, 'read', authenticate, authorizeLookup('inventory'), validate(listRequest), inventoryStockController.list),
  },
  [`${PKG}.InventoryTransactionsService`]: {
    List: route(`${PKG}.InventoryTransactionList`, 'read', authenticate, authorize('inventory', 'view'), validate(listRequest), inventoryTransactionsController.list),
    // Idempotent: a double-submitted IN or OUT must not move the stock twice.
    StockIn: route(`${PKG}.InventoryTransaction`, 'write', authenticate, authorize('inventory', 'add'), validate(stockInRequest), idempotency, inventoryTransactionsController.stockIn),
    StockOut: route(`${PKG}.InventoryTransaction`, 'write', authenticate, authorize('inventory', 'add'), validate(stockOutRequest), idempotency, inventoryTransactionsController.stockOut),
  },
};
