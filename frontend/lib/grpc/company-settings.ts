import { fleetflow } from '../generated/proto/messages.js';
import { unaryCall } from './client';

const { CompanySettings, GetRequest, UpdateCompanySettingsRequest } = fleetflow.companysettings;
const SERVICE = 'fleetflow.companysettings.CompanySettingsService';

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

export const companySettingsClient = {
  get(token: string): Promise<CompanySettingsDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Get',
      request: GetRequest.create({}),
      RequestType: GetRequest,
      ResponseType: CompanySettings,
      token,
    }) as Promise<CompanySettingsDto>;
  },
  update(values: Record<string, unknown>, token: string): Promise<CompanySettingsDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Update',
      request: UpdateCompanySettingsRequest.create(values),
      RequestType: UpdateCompanySettingsRequest,
      ResponseType: CompanySettings,
      token,
    }) as Promise<CompanySettingsDto>;
  },
};
