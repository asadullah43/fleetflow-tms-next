import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';
import { inventoryItemsService, inventoryStockService, inventoryTransactionsService, warehousesService } from '../services/inventory.service.js';
import { crudController } from './crud.controller.js';

export const warehousesController = crudController(warehousesService);
export const inventoryItemsController = crudController(inventoryItemsService);

export const inventoryStockController = {
  list: ((ctx) => inventoryStockService.list(ctx.input)) as Controller<ListQuery>,
};

export const inventoryTransactionsController = {
  list: ((ctx) => inventoryTransactionsService.list(ctx.input)) as Controller<ListQuery>,
  stockIn: ((ctx) => inventoryTransactionsService.stockIn(ctx.input)) as Controller,
  stockOut: ((ctx) => inventoryTransactionsService.stockOut(ctx.input)) as Controller,
};
