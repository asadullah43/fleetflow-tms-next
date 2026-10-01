import { rateContractsService } from '../services/rate-contracts.service.js';
import { crudController } from './crud.controller.js';

export const rateContractsController = crudController(rateContractsService);
