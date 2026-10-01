import { z } from 'zod';
import { optionalText } from './common.validation.js';

export const updateCompanySettingsRequest = z.object({
  companyName: optionalText,
  logoUrl: optionalText,
  vatNumber: optionalText,
  crNumber: optionalText,
  branchName: optionalText,
  industryCategory: optionalText,
  city: optionalText,
  country: optionalText,
  address: optionalText,
  streetName: optionalText,
  buildingNumber: optionalText,
  postalCode: optionalText,
  bankName: optionalText,
  bankAccount: optionalText,
  phone: optionalText,
  email: optionalText,
});
