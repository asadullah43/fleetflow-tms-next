import { locationsService } from '../services/locations.service.js';
import { crudController } from './crud.controller.js';

export const locationsController = crudController(locationsService);
