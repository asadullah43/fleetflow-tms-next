import { z } from 'zod';
import { id, language, optionalText, requiredText } from './common.validation.js';

export const createDriverRequest = z.object({
  name: requiredText,
  language: language.optional(),
  phone: optionalText,
  licenseNo: optionalText,
  idNumber: optionalText,
  status: optionalText,
  nameAr: optionalText,
});

export const updateDriverRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  phone: optionalText,
  licenseNo: optionalText,
  idNumber: optionalText,
  status: optionalText,
  nameAr: optionalText,
});
