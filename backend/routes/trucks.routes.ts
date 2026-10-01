import { trucksController } from '../controllers/trucks.controller.js';
import { createTruckRequest, updateTruckRequest } from '../validations/trucks.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const trucksRoutes: ServiceRoutes = {
  'fleetflow.trucks.TrucksService': crudRoutes({
    type: 'fleetflow.trucks.Truck',
    module: 'trucks',
    controller: trucksController,
    lookup: true,
    createSchema: createTruckRequest,
    updateSchema: updateTruckRequest,
  }),
};
