import { supplierPaymentsController } from '../controllers/supplier-payments.controller.js';
import { createSupplierPaymentRequest, updateSupplierPaymentRequest } from '../validations/supplier-payments.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const supplierPaymentsRoutes: ServiceRoutes = {
  'fleetflow.supplierpayments.SupplierPaymentsService': crudRoutes({
    type: 'fleetflow.supplierpayments.SupplierPayment',
    module: 'supplierPayments',
    controller: supplierPaymentsController,
    createSchema: createSupplierPaymentRequest,
    updateSchema: updateSupplierPaymentRequest,
  }),
};
