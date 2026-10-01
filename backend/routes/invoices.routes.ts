import { invoicesController } from '../controllers/invoices.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize } from '../middlewares/authorization.js';
import { validate } from '../middlewares/validation.js';
import { idRequest } from '../validations/common.validation.js';
import { createInvoiceRequest, updateInvoiceRequest } from '../validations/invoices.validation.js';
import { crudRoutes } from './crud.routes.js';
import { route, ServiceRoutes } from './router.js';

const INVOICE = 'fleetflow.invoices.Invoice';

export const invoicesRoutes: ServiceRoutes = {
  'fleetflow.invoices.InvoicesService': {
    ...crudRoutes({
      type: INVOICE,
      module: 'invoices',
      controller: invoicesController,
      createSchema: createInvoiceRequest,
      updateSchema: updateInvoiceRequest,
    }),
    // Both are safe to retry by design: the service only acts on an invoice still in the "before" state.
    MarkPaid: route(INVOICE, 'write', authenticate, authorize('invoices', 'edit'), validate(idRequest), invoicesController.markPaid),
    SubmitToZatca: route(INVOICE, 'write', authenticate, authorize('invoices', 'edit'), validate(idRequest), invoicesController.submitToZatca),
  },
};
