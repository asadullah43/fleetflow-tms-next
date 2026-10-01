import { workOrdersController, maintenanceSchedulesController, vehicleInspectionsController, sparePartsController, workshopExpensesController, workOrderPartsController, inspectionItemsController, sparePartTransactionsController } from '../controllers/workshop.controller.js';
import { createInspectionItemRequest, createMaintenanceScheduleRequest, createSparePartRequest, createSparePartTransactionRequest, createVehicleInspectionRequest, createWorkOrderPartRequest, createWorkOrderRequest, createWorkshopExpenseRequest, updateInspectionItemRequest, updateMaintenanceScheduleRequest, updateSparePartRequest, updateVehicleInspectionRequest, updateWorkOrderPartRequest, updateWorkOrderRequest, updateWorkshopExpenseRequest } from '../validations/workshop.validation.js';
import { crudRoutes } from './crud.routes.js';
import type { ServiceRoutes } from './router.js';

export const workshopRoutes: ServiceRoutes = {
  'fleetflow.workshop.WorkOrdersService': crudRoutes({
    type: 'fleetflow.workshop.WorkOrder',
    module: 'workshop',
    controller: workOrdersController,
    createSchema: createWorkOrderRequest,
    updateSchema: updateWorkOrderRequest,
  }),
  'fleetflow.workshop.MaintenanceSchedulesService': crudRoutes({
    type: 'fleetflow.workshop.MaintenanceSchedule',
    module: 'workshop',
    controller: maintenanceSchedulesController,
    createSchema: createMaintenanceScheduleRequest,
    updateSchema: updateMaintenanceScheduleRequest,
  }),
  'fleetflow.workshop.VehicleInspectionsService': crudRoutes({
    type: 'fleetflow.workshop.VehicleInspection',
    module: 'workshop',
    controller: vehicleInspectionsController,
    createSchema: createVehicleInspectionRequest,
    updateSchema: updateVehicleInspectionRequest,
  }),
  'fleetflow.workshop.SparePartsService': crudRoutes({
    type: 'fleetflow.workshop.SparePart',
    module: 'workshop',
    controller: sparePartsController,
    createSchema: createSparePartRequest,
    updateSchema: updateSparePartRequest,
  }),
  'fleetflow.workshop.WorkshopExpensesService': crudRoutes({
    type: 'fleetflow.workshop.WorkshopExpense',
    module: 'workshop',
    controller: workshopExpensesController,
    createSchema: createWorkshopExpenseRequest,
    updateSchema: updateWorkshopExpenseRequest,
  }),
  'fleetflow.workshop.WorkOrderPartsService': crudRoutes({
    type: 'fleetflow.workshop.WorkOrderPart',
    module: 'workshop',
    controller: workOrderPartsController,
    createSchema: createWorkOrderPartRequest,
    updateSchema: updateWorkOrderPartRequest,
    operations: ['list', 'create', 'update', 'delete'],
  }),
  'fleetflow.workshop.InspectionItemsService': crudRoutes({
    type: 'fleetflow.workshop.InspectionItem',
    module: 'workshop',
    controller: inspectionItemsController,
    createSchema: createInspectionItemRequest,
    updateSchema: updateInspectionItemRequest,
    operations: ['list', 'create', 'update', 'delete'],
  }),
  'fleetflow.workshop.SparePartTransactionsService': crudRoutes({
    type: 'fleetflow.workshop.SparePartTransaction',
    module: 'workshop',
    controller: sparePartTransactionsController,
    createSchema: createSparePartTransactionRequest,
    operations: ['list', 'create', 'delete'],
  }),
};
