import { z } from 'zod';
import { id, language, optionalText, requiredText } from './common.validation.js';

export const createLocationRequest = z.object({
  name: requiredText,
  language: language.optional(),
  description: optionalText,
  status: optionalText,
  nameAr: optionalText,
  descriptionAr: optionalText,
});

export const updateLocationRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  description: optionalText,
  status: optionalText,
  nameAr: optionalText,
  descriptionAr: optionalText,
});
