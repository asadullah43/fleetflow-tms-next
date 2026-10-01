import { tripsController } from '../controllers/trips.controller.js';
import { createTripRequest, updateTripRequest } from '../validations/trips.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const tripsRoutes: ServiceRoutes = {
  'fleetflow.trips.TripsService': crudRoutes({
    type: 'fleetflow.trips.Trip',
    module: 'trips',
    controller: tripsController,
    createSchema: createTripRequest,
    updateSchema: updateTripRequest,
  }),
};
