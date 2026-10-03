import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { createCrudApi, listCall } from './crud-api';
import type { ListQuery, Page } from './types';

const ws = fleetflow.workshop;

export interface WorkOrderDto {
  id: number;
  orderNumber: string;
  truckId: number;
  driverId?: number;
  supplierId?: number;
  issue: string;
  diagnosis?: string;
  description?: string;
  priority: string;
  status: string;
  startDate?: string;
  completionDate?: string;
  odometer?: string;
  laborCost: string;
  partsCost: string;
  otherCost: string;
  totalCost: string;
  notes?: string;
  truckNumber?: string;
  driverName?: string;
  driverNameAr?: string;
}
export const workOrdersApi = createCrudApi<WorkOrderDto>('workOrders', 'fleetflow.workshop.WorkOrdersService', ws, 'WorkOrder');

export interface MaintenanceScheduleDto {
  id: number;
  truckId: number;
  maintenanceType: string;
  description?: string;
  mileageInterval?: string;
  dayInterval?: number;
  lastService?: string;
  nextService?: string;
  status: string;
  notes?: string;
  truckNumber?: string;
}
export const maintenanceSchedulesApi = createCrudApi<MaintenanceScheduleDto>('maintenanceSchedules', 'fleetflow.workshop.MaintenanceSchedulesService', ws, 'MaintenanceSchedule');

export interface VehicleInspectionDto {
  id: number;
  truckId: number;
  inspectorId: number;
  inspectDate: string;
  odometer?: string;
  notes?: string;
  result: string;
  attachments?: string;
  truckNumber?: string;
  inspectorName?: string;
}
export const vehicleInspectionsApi = createCrudApi<VehicleInspectionDto>('vehicleInspections', 'fleetflow.workshop.VehicleInspectionsService', ws, 'VehicleInspection');

export interface WorkshopExpenseDto {
  id: number;
  truckId: number;
  workOrderId?: number;
  category: string;
  amount: string;
  description?: string;
  expenseDate: string;
  truckNumber?: string;
}
export const workshopExpensesApi = createCrudApi<WorkshopExpenseDto>('workshopExpenses', 'fleetflow.workshop.WorkshopExpensesService', ws, 'WorkshopExpense');

/** Inventory used on a work order: drawn from one warehouse, valued at the item's cost, added to the order's parts cost. */
export interface WorkOrderPartDto {
  id: number;
  workOrderId: number;
  itemId: number;
  warehouseId: number;
  quantity: number;
  unitCost: string;
  totalCost: string;
  itemName?: string;
  itemNameAr?: string;
  itemNumber?: string;
  warehouseName?: string;
  warehouseNameAr?: string;
  createdAt?: string;
}

export interface NewWorkOrderPart {
  workOrderId: number;
  itemId: number;
  warehouseId: number;
  quantity: number;
}

const PARTS = 'fleetflow.workshop.WorkOrderPartsService';

/** Lines are added or removed, never edited (removing one returns its stock to the warehouse). */
export const workOrderPartsApi = {
  key: 'workOrderParts',
  list: (query?: ListQuery): Promise<Page<WorkOrderPartDto>> => listCall<WorkOrderPartDto>(PARTS, 'List', ws.ListRequest, query),
  create: (values: NewWorkOrderPart, idempotencyKey: string) => apiCall<WorkOrderPartDto>({ service: PARTS, method: 'Create', RequestType: ws.CreateWorkOrderPartRequest, request: { ...values }, idempotencyKey }),
  remove: (id: number) => apiCall({ service: PARTS, method: 'Delete', RequestType: ws.IdRequest, request: { id } }).then(() => undefined),
};
