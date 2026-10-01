import { suppliersService } from '../services/suppliers.service.js';
import { crudController } from './crud.controller.js';

export const suppliersController = crudController(suppliersService);
