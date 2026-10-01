import { tripsService } from '../services/trips.service.js';
import { crudController } from './crud.controller.js';

export const tripsController = crudController(tripsService);
