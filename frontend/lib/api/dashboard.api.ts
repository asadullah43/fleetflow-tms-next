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
  lowStockSpareParts: number;
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
  lowStockSpareParts: number;
  expensesThisMonth: string;
  openByPriority: LabelCountDto[];
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
};
