import { customersController } from '../controllers/customers.controller.js';
import { createCustomerRequest, updateCustomerRequest } from '../validations/customers.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const customersRoutes: ServiceRoutes = {
  'fleetflow.customers.CustomersService': crudRoutes({
    type: 'fleetflow.customers.Customer',
    module: 'customers',
    controller: customersController,
    lookup: true,
    createSchema: createCustomerRequest,
    updateSchema: updateCustomerRequest,
  }),
};
