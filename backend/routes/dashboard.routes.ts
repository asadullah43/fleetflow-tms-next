import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/authentication.js';
import { authorize } from '../middlewares/authorization.js';
import { validate } from '../middlewares/validation.js';
import { emptyRequest } from '../validations/common.validation.js';
import { route, ServiceRoutes } from './router.js';

const dashboard = [authenticate, authorize('dashboard', 'view')] as const;

export const dashboardRoutes: ServiceRoutes = {
  'fleetflow.dashboard.DashboardService': {
    GetSummary: route('fleetflow.dashboard.SummaryResponse', 'read', ...dashboard, validate(emptyRequest), dashboardController.getSummary),
    // The HR, workshop and inventory tabs also need that module's own view permission.
    GetHrSummary: route('fleetflow.dashboard.HrSummary', 'read', ...dashboard, authorize('hr', 'view'), validate(emptyRequest), dashboardController.getHrSummary),
    GetWorkshopSummary: route(
      'fleetflow.dashboard.WorkshopSummary',
      'read',
      ...dashboard,
      authorize('workshop', 'view'),
      validate(emptyRequest),
      dashboardController.getWorkshopSummary,
    ),
    GetFleetSummary: route('fleetflow.dashboard.FleetSummary', 'read', ...dashboard, validate(emptyRequest), dashboardController.getFleetSummary),
    GetInventorySummary: route(
      'fleetflow.dashboard.InventorySummary',
      'read',
      ...dashboard,
      authorize('inventory', 'view'),
      validate(emptyRequest),
      dashboardController.getInventorySummary,
    ),
  },
};
