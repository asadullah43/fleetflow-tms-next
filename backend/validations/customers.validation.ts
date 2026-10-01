import { z } from 'zod';
import { id, language, optionalText, requiredText } from './common.validation.js';

export const createCustomerRequest = z.object({
  name: requiredText,
  language: language.optional(),
  contactPerson: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  vatNumber: optionalText,
  crNumber: optionalText,
  streetName: optionalText,
  buildingNumber: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: optionalText,
  status: optionalText,
  nameAr: optionalText,
});

export const updateCustomerRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  contactPerson: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  vatNumber: optionalText,
  crNumber: optionalText,
  streetName: optionalText,
  buildingNumber: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: optionalText,
  status: optionalText,
  nameAr: optionalText,
});
