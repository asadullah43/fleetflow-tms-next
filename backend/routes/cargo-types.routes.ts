import { cargoTypesController } from '../controllers/cargo-types.controller.js';
import { createCargoTypeRequest, updateCargoTypeRequest } from '../validations/cargo-types.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const cargoTypesRoutes: ServiceRoutes = {
  'fleetflow.cargotypes.CargoTypesService': crudRoutes({
    type: 'fleetflow.cargotypes.CargoType',
    module: 'cargoTypes',
    controller: cargoTypesController,
    lookup: true,
    createSchema: createCargoTypeRequest,
    updateSchema: updateCargoTypeRequest,
  }),
};
