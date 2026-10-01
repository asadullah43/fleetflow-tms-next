import { locationsController } from '../controllers/locations.controller.js';
import { createLocationRequest, updateLocationRequest } from '../validations/locations.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const locationsRoutes: ServiceRoutes = {
  'fleetflow.locations.LocationsService': crudRoutes({
    type: 'fleetflow.locations.Location',
    module: 'locations',
    controller: locationsController,
    lookup: true,
    createSchema: createLocationRequest,
    updateSchema: updateLocationRequest,
  }),
};
