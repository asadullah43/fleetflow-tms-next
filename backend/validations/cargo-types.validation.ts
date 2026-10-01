import { z } from 'zod';
import { id, language, optionalText, requiredText } from './common.validation.js';

export const createCargoTypeRequest = z.object({
  name: requiredText,
  language: language.optional(),
  description: optionalText,
  status: optionalText,
  pricingMode: optionalText,
  nameAr: optionalText,
  descriptionAr: optionalText,
});

export const updateCargoTypeRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  description: optionalText,
  status: optionalText,
  pricingMode: optionalText,
  nameAr: optionalText,
  descriptionAr: optionalText,
});
