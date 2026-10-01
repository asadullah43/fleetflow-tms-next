import { companySettingsController } from '../controllers/company-settings.controller.js';
import { authenticate, authenticateIfPresent } from '../middlewares/authentication.js';
import { authorize, authorizeLookup } from '../middlewares/authorization.js';
import { validate } from '../middlewares/validation.js';
import { emptyRequest } from '../validations/common.validation.js';
import { updateCompanySettingsRequest } from '../validations/company-settings.validation.js';
import { route, ServiceRoutes } from './router.js';

export const companySettingsRoutes: ServiceRoutes = {
  'fleetflow.companysettings.CompanySettingsService': {
    // Any signed-in user: printed documents (invoices, loading orders) carry the company header.
    Get: route('fleetflow.companysettings.CompanySettings', 'read', authenticate, authorizeLookup('settings'), validate(emptyRequest), companySettingsController.get),
    Update: route(
      'fleetflow.companysettings.CompanySettings',
      'write',
      authenticate,
      authorize('settings', 'edit'),
      validate(updateCompanySettingsRequest),
      companySettingsController.update,
    ),
    // Name and logo only. Signed in: the caller's own company. Not signed in (login screen): the default company.
    GetBranding: route('fleetflow.companysettings.CompanyBranding', 'read', authenticateIfPresent, validate(emptyRequest), companySettingsController.getBranding),
  },
};
