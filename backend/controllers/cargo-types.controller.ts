import { cargoTypesService } from '../services/cargo-types.service.js';
import { crudController } from './crud.controller.js';

export const cargoTypesController = crudController(cargoTypesService);
