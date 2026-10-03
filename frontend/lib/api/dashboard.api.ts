import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';

const { SummaryRequest } = fleetflow.dashboard;
const SERVICE = 'fleetflow.dashboard.DashboardService';

export interface DashboardSummaryDto {
  activeTrucks: number;
  activeDrivers: number;
  tripsThisMonth: number;
  openWorkOrders: number;
  unpaidInvoicesTotal: string;
  unpaidInvoicesCount: number;
  pendingLeaveRequests: number;
  /** Active inventory items at or below their minimum (total across warehouses). */
  lowStockItems: number;
}

export interface LabelCountDto {
  label: string;
  labelAr?: string;
  count: number;
}

export interface HrSummaryDto {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  terminatedEmployees: number;
  departments: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingLeaveRequests: number;
  contractsExpiring: number;
  headcountByDepartment: LabelCountDto[];
}

export interface WorkshopSummaryDto {
  openWorkOrders: number;
  inProgressWorkOrders: number;
  completedThisMonth: number;
  overdueMaintenance: number;
  failedInspections: number;
  expensesThisMonth: string;
  openByPriority: LabelCountDto[];
}

export interface WarehouseStockDto {
  warehouseId: number;
  name: string;
  nameAr?: string;
  /** Distinct items with stock here. */
  items: number;
  units: number;
}

export interface StockLevelRowDto {
  warehouseId: number;
  warehouseName: string;
  warehouseNameAr?: string;
  itemId: number;
  itemName: string;
  itemNameAr?: string;
  itemNumber?: string;
  quantity: number;
}

export interface LowStockItemDto {
  itemId: number;
  name: string;
  nameAr?: string;
  itemNumber?: string;
  totalQuantity: number;
  minimumStock: number;
}

/** Low stock = an active item whose total across all warehouses is at or below its minimum. */
export interface InventorySummaryDto {
  activeItems: number;
  activeWarehouses: number;
  totalUnits: number;
  lowStockItems: number;
  byWarehouse: WarehouseStockDto[];
  /** Per warehouse per item — the first rows only; `stockLevelsTotal` says how many exist. */
  stockLevels: StockLevelRowDto[];
  stockLevelsTotal: number;
  lowStock: LowStockItemDto[];
}

export interface FleetSummaryDto {
  fleetSize: number;
  activeTrucks: number;
}

const summary = <T>(method: string) => apiCall<T>({ service: SERVICE, method, RequestType: SummaryRequest });

/** Every figure is computed by the backend; the dashboard never counts rows itself. */
export const dashboardApi = {
  getSummary: () => summary<DashboardSummaryDto>('GetSummary'),
  getHrSummary: () => summary<HrSummaryDto>('GetHrSummary'),
  getWorkshopSummary: () => summary<WorkshopSummaryDto>('GetWorkshopSummary'),
  getFleetSummary: () => summary<FleetSummaryDto>('GetFleetSummary'),
  getInventorySummary: () => summary<InventorySummaryDto>('GetInventorySummary'),
};
