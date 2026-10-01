import { driversController } from '../controllers/drivers.controller.js';
import { createDriverRequest, updateDriverRequest } from '../validations/drivers.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const driversRoutes: ServiceRoutes = {
  'fleetflow.drivers.DriversService': crudRoutes({
    type: 'fleetflow.drivers.Driver',
    module: 'drivers',
    controller: driversController,
    lookup: true,
    createSchema: createDriverRequest,
    updateSchema: updateDriverRequest,
  }),
};
