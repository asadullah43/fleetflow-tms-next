import { supplierPaymentsService } from '../services/supplier-payments.service.js';
import { crudController } from './crud.controller.js';

export const supplierPaymentsController = crudController(supplierPaymentsService);
