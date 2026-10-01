import { suppliersController } from '../controllers/suppliers.controller.js';
import { createSupplierRequest, updateSupplierRequest } from '../validations/suppliers.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const suppliersRoutes: ServiceRoutes = {
  'fleetflow.suppliers.SuppliersService': crudRoutes({
    type: 'fleetflow.suppliers.Supplier',
    module: 'suppliers',
    controller: suppliersController,
    lookup: true,
    createSchema: createSupplierRequest,
    updateSchema: updateSupplierRequest,
  }),
};
