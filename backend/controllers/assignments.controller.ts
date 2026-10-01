import { assignmentsService } from '../services/assignments.service.js';
import { crudController } from './crud.controller.js';

export const assignmentsController = crudController(assignmentsService);
