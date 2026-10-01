import { trucksService } from '../services/trucks.service.js';
import { crudController } from './crud.controller.js';

export const trucksController = crudController(trucksService);
