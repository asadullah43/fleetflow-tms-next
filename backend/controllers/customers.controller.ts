import { customersService } from '../services/customers.service.js';
import { crudController } from './crud.controller.js';

export const customersController = crudController(customersService);
