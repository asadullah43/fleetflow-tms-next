import { z } from 'zod';
import { id, language, optionalText, requiredText } from './common.validation.js';

export const createSupplierRequest = z.object({
  name: requiredText,
  language: language.optional(),
  contactPerson: optionalText,
  phone: optionalText,
  email: optionalText,
  status: optionalText,
  nameAr: optionalText,
});

export const updateSupplierRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  contactPerson: optionalText,
  phone: optionalText,
  email: optionalText,
  status: optionalText,
  nameAr: optionalText,
});
