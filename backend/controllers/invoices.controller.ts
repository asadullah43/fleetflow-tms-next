import type { Controller } from '../middlewares/request-context.js';
import { invoicesService } from '../services/invoices.service.js';
import { crudController } from './crud.controller.js';

export const invoicesController = {
  ...crudController(invoicesService),
  markPaid: ((ctx) => invoicesService.markPaid(ctx.input.id)) as Controller<{ id: number }>,
  submitToZatca: ((ctx) => invoicesService.submitToZatca(ctx.input.id)) as Controller<{ id: number }>,
};
