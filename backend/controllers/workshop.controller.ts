import { workOrdersService, maintenanceSchedulesService, vehicleInspectionsService, sparePartsService, workshopExpensesService, workOrderPartsService, inspectionItemsService, sparePartTransactionsService } from '../services/workshop.service.js';
import { crudController } from './crud.controller.js';

export const workOrdersController = crudController(workOrdersService);
export const maintenanceSchedulesController = crudController(maintenanceSchedulesService);
export const vehicleInspectionsController = crudController(vehicleInspectionsService);
export const sparePartsController = crudController(sparePartsService);
export const workshopExpensesController = crudController(workshopExpensesService);
export const workOrderPartsController = crudController(workOrderPartsService);
export const inspectionItemsController = crudController(inspectionItemsService);
export const sparePartTransactionsController = crudController(sparePartTransactionsService);
