import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';

const { GetRequest, UpdateCompanySettingsRequest } = fleetflow.companysettings;
const SERVICE = 'fleetflow.companysettings.CompanySettingsService';

export interface CompanyBrandingDto {
  companyName: string;
  logoUrl?: string;
}

export interface CompanySettingsDto {
  id: number;
  companyName: string;
  logoUrl?: string;
  vatNumber?: string;
  crNumber?: string;
  branchName?: string;
  industryCategory?: string;
  city?: string;
  country: string;
  address?: string;
  streetName?: string;
  buildingNumber?: string;
  postalCode?: string;
  bankName?: string;
  bankAccount?: string;
  phone?: string;
  email?: string;
}

export const companySettingsApi = {
  get: () => apiCall<CompanySettingsDto>({ service: SERVICE, method: 'Get', RequestType: GetRequest }),
  update: (values: Record<string, unknown>) => apiCall<CompanySettingsDto>({ service: SERVICE, method: 'Update', RequestType: UpdateCompanySettingsRequest, request: values }),
  /** Name and logo only. Signed in: the user's own company; signed out (login screen): the default company. */
  getBranding: () => apiCall<CompanyBrandingDto>({ service: SERVICE, method: 'GetBranding', RequestType: GetRequest }),
};
