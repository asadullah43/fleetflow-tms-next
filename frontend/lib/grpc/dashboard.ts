import { fleetflow } from '../generated/proto/messages.js';
import { unaryCall } from './client';

const { SummaryRequest, SummaryResponse } = fleetflow.dashboard;

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

export const dashboardClient = {
  getSummary(token: string): Promise<DashboardSummaryDto> {
    return unaryCall({
      serviceName: 'fleetflow.dashboard.DashboardService',
      methodName: 'GetSummary',
      request: SummaryRequest.create({}),
      RequestType: SummaryRequest,
      ResponseType: SummaryResponse,
      token,
    }) as Promise<DashboardSummaryDto>;
  },
};
