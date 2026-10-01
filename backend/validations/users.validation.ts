import { z } from 'zod';
import { id, language, optionalId, optionalText, requiredText } from './common.validation.js';

export const createUserRequest = z.object({
  name: requiredText,
  email: requiredText.pipe(z.string().email()),
  username: optionalText,
  password: z.string().min(1),
  role: optionalText,
  roleId: optionalId,
  language: language.optional(),
  status: optionalText,
});

export const updateUserRequest = z.object({
  id: id,
  name: optionalText,
  email: optionalText,
  username: optionalText,
  password: z.string().optional(),
  role: optionalText,
  roleId: optionalId,
  language: language.optional(),
  status: optionalText,
});
