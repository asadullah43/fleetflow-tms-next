import type { Controller } from '../middlewares/request-context.js';
import { dashboardService } from '../services/dashboard.service.js';

export const dashboardController = {
  getSummary: (() => dashboardService.getSummary()) as Controller,
  getHrSummary: (() => dashboardService.getHrSummary()) as Controller,
  getWorkshopSummary: (() => dashboardService.getWorkshopSummary()) as Controller,
  getFleetSummary: (() => dashboardService.getFleetSummary()) as Controller,
  getInventorySummary: (() => dashboardService.getInventorySummary()) as Controller,
};
