import { rpc } from '../../lib/grpc-handler.js';
import { companySettingsService } from './company-settings.service.js';

export const companySettingsGrpcImpl = {
  // Any signed-in user: printed documents (loading-order slips, invoices) need the company header.
  get: rpc('authenticated', () => companySettingsService.getOrCreate(), 'read'),
  update: rpc({ module: 'settings', action: 'edit' }, (req: Record<string, unknown>) => companySettingsService.update(req)),
  // Public — the login screen and sidebar need company name/logo before
  // there's a session. The underlying row has far more on it (VAT, bank
  // account, address, ...); the CompanyBranding proto message only has
  // company_name/logo_url fields, so only those go out on the wire.
  getBranding: rpc('public', () => companySettingsService.getOrCreate(), 'read'),
};
