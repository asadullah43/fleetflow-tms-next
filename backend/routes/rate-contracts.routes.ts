import { rateContractsController } from '../controllers/rate-contracts.controller.js';
import { createRateContractRequest, updateRateContractRequest } from '../validations/rate-contracts.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const rateContractsRoutes: ServiceRoutes = {
  'fleetflow.ratecontracts.RateContractsService': crudRoutes({
    type: 'fleetflow.ratecontracts.RateContract',
    module: 'rateContracts',
    controller: rateContractsController,
    createSchema: createRateContractRequest,
    updateSchema: updateRateContractRequest,
  }),
};
