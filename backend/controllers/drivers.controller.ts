import { driversService } from '../services/drivers.service.js';
import { crudController } from './crud.controller.js';

export const driversController = crudController(driversService);
