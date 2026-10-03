import { workOrdersService, maintenanceSchedulesService, vehicleInspectionsService, workshopExpensesService, workOrderPartsService, inspectionItemsService } from '../services/workshop.service.js';
import { crudController } from './crud.controller.js';

export const workOrdersController = crudController(workOrdersService);
export const maintenanceSchedulesController = crudController(maintenanceSchedulesService);
export const vehicleInspectionsController = crudController(vehicleInspectionsService);
export const workshopExpensesController = crudController(workshopExpensesService);
export const workOrderPartsController = crudController(workOrderPartsService);
export const inspectionItemsController = crudController(inspectionItemsService);
