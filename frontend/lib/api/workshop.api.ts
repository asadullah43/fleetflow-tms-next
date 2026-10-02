import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

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

export interface SparePartDto {
  id: number;
  name: string;
  nameAr?: string;
  partNumber?: string;
  category?: string;
  quantity: number;
  minimumStock: number;
  unitCost: string;
  supplierId?: number;
  status: string;
  supplierName?: string;
  supplierNameAr?: string;
}
export const sparePartsApi = createCrudApi<SparePartDto>('spareParts', 'fleetflow.workshop.SparePartsService', ws, 'SparePart');

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
