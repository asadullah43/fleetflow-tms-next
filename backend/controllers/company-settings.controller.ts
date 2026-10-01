import type { Controller } from '../middlewares/request-context.js';
import { companySettingsService } from '../services/company-settings.service.js';

export const companySettingsController = {
  get: (() => companySettingsService.getOrCreate()) as Controller,
  getBranding: (() => companySettingsService.getBranding()) as Controller,
  update: ((ctx) => companySettingsService.update(ctx.input)) as Controller<Record<string, unknown>>,
};
