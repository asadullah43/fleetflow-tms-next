import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';
import { unaryCall } from './client';

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
export const workOrdersClient = createCrudClient<WorkOrderDto>('fleetflow.workshop.WorkOrdersService', {
  ListRequest: ws.ListRequest,
  ItemList: ws.WorkOrderList,
  Item: ws.WorkOrder,
  IdRequest: ws.IdRequest,
  CreateRequest: ws.CreateWorkOrderRequest,
  UpdateRequest: ws.UpdateWorkOrderRequest,
  DeleteResponse: ws.DeleteResponse,
});

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
export const maintenanceSchedulesClient = createCrudClient<MaintenanceScheduleDto>('fleetflow.workshop.MaintenanceSchedulesService', {
  ListRequest: ws.ListRequest,
  ItemList: ws.MaintenanceScheduleList,
  Item: ws.MaintenanceSchedule,
  IdRequest: ws.IdRequest,
  CreateRequest: ws.CreateMaintenanceScheduleRequest,
  UpdateRequest: ws.UpdateMaintenanceScheduleRequest,
  DeleteResponse: ws.DeleteResponse,
});

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
export const vehicleInspectionsClient = createCrudClient<VehicleInspectionDto>('fleetflow.workshop.VehicleInspectionsService', {
  ListRequest: ws.ListRequest,
  ItemList: ws.VehicleInspectionList,
  Item: ws.VehicleInspection,
  IdRequest: ws.IdRequest,
  CreateRequest: ws.CreateVehicleInspectionRequest,
  UpdateRequest: ws.UpdateVehicleInspectionRequest,
  DeleteResponse: ws.DeleteResponse,
});

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
export const sparePartsClient = createCrudClient<SparePartDto>('fleetflow.workshop.SparePartsService', {
  ListRequest: ws.ListRequest,
  ItemList: ws.SparePartList,
  Item: ws.SparePart,
  IdRequest: ws.IdRequest,
  CreateRequest: ws.CreateSparePartRequest,
  UpdateRequest: ws.UpdateSparePartRequest,
  DeleteResponse: ws.DeleteResponse,
});

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
export const workshopExpensesClient = createCrudClient<WorkshopExpenseDto>('fleetflow.workshop.WorkshopExpensesService', {
  ListRequest: ws.ListRequest,
  ItemList: ws.WorkshopExpenseList,
  Item: ws.WorkshopExpense,
  IdRequest: ws.IdRequest,
  CreateRequest: ws.CreateWorkshopExpenseRequest,
  UpdateRequest: ws.UpdateWorkshopExpenseRequest,
  DeleteResponse: ws.DeleteResponse,
});

// ---- Nested line-item tables (no Get RPC; narrower method sets) ----

export interface WorkOrderPartDto {
  id: number;
  workOrderId: number;
  sparePartId: number;
  quantity: number;
  unitCost: string;
  totalCost: string;
  sparePartName?: string;
}
export const workOrderPartsClient = {
  list(token: string): Promise<WorkOrderPartDto[]> {
    return unaryCall({
      serviceName: 'fleetflow.workshop.WorkOrderPartsService',
      methodName: 'List',
      request: ws.ListRequest.create({}),
      RequestType: ws.ListRequest,
      ResponseType: ws.WorkOrderPartList,
      token,
    }).then((res) => (res.items ?? []) as unknown as WorkOrderPartDto[]);
  },
  create(values: Record<string, unknown>, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.WorkOrderPartsService',
      methodName: 'Create',
      request: ws.CreateWorkOrderPartRequest.create(values),
      RequestType: ws.CreateWorkOrderPartRequest,
      ResponseType: ws.WorkOrderPart,
      token,
    });
  },
  remove(id: number, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.WorkOrderPartsService',
      methodName: 'Delete',
      request: ws.IdRequest.create({ id }),
      RequestType: ws.IdRequest,
      ResponseType: ws.DeleteResponse,
      token,
    }).then(() => undefined);
  },
};

export interface InspectionItemDto {
  id: number;
  inspectionId: number;
  workOrderId?: number;
  checklistItem: string;
  status: string;
  defect?: string;
}
export const inspectionItemsClient = {
  list(token: string): Promise<InspectionItemDto[]> {
    return unaryCall({
      serviceName: 'fleetflow.workshop.InspectionItemsService',
      methodName: 'List',
      request: ws.ListRequest.create({}),
      RequestType: ws.ListRequest,
      ResponseType: ws.InspectionItemList,
      token,
    }).then((res) => (res.items ?? []) as unknown as InspectionItemDto[]);
  },
  create(values: Record<string, unknown>, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.InspectionItemsService',
      methodName: 'Create',
      request: ws.CreateInspectionItemRequest.create(values),
      RequestType: ws.CreateInspectionItemRequest,
      ResponseType: ws.InspectionItem,
      token,
    });
  },
  remove(id: number, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.InspectionItemsService',
      methodName: 'Delete',
      request: ws.IdRequest.create({ id }),
      RequestType: ws.IdRequest,
      ResponseType: ws.DeleteResponse,
      token,
    }).then(() => undefined);
  },
};

export interface SparePartTransactionDto {
  id: number;
  sparePartId: number;
  transactionType: string;
  quantity: number;
  referenceNote?: string;
  sparePartName?: string;
}
export const sparePartTransactionsClient = {
  list(token: string): Promise<SparePartTransactionDto[]> {
    return unaryCall({
      serviceName: 'fleetflow.workshop.SparePartTransactionsService',
      methodName: 'List',
      request: ws.ListRequest.create({}),
      RequestType: ws.ListRequest,
      ResponseType: ws.SparePartTransactionList,
      token,
    }).then((res) => (res.items ?? []) as unknown as SparePartTransactionDto[]);
  },
  create(values: Record<string, unknown>, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.SparePartTransactionsService',
      methodName: 'Create',
      request: ws.CreateSparePartTransactionRequest.create(values),
      RequestType: ws.CreateSparePartTransactionRequest,
      ResponseType: ws.SparePartTransaction,
      token,
    });
  },
  remove(id: number, token: string) {
    return unaryCall({
      serviceName: 'fleetflow.workshop.SparePartTransactionsService',
      methodName: 'Delete',
      request: ws.IdRequest.create({ id }),
      RequestType: ws.IdRequest,
      ResponseType: ws.DeleteResponse,
      token,
    }).then(() => undefined);
  },
};
