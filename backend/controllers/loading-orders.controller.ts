import type { Controller } from '../middlewares/request-context.js';
import type { ListQuery } from '../models/api-response.js';
import { loadingOrdersService } from '../services/loading-orders.service.js';

type BatchInput = { batchId: number };

export const loadingOrdersController = {
  listGrouped: ((ctx) => loadingOrdersService.listGrouped(ctx.input)) as Controller<ListQuery>,
  getBatch: ((ctx) => loadingOrdersService.findByBatch(ctx.input.batchId)) as Controller<BatchInput>,
  getBatchDocument: ((ctx) => loadingOrdersService.getBatchDocument(ctx.input.batchId)) as Controller<BatchInput>,
  create: ((ctx) => loadingOrdersService.create(ctx.input)) as Controller,
  deleteBatch: (async (ctx) => {
    await loadingOrdersService.removeBatch(ctx.input.batchId);
    return {};
  }) as Controller<BatchInput>,
};
