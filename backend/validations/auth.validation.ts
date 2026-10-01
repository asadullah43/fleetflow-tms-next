import { z } from 'zod';
import { language, requiredText } from './common.validation.js';

export const loginRequest = z.object({
  username: requiredText,
  password: z.string().min(1), // not trimmed: spaces can be part of a password
  language: language.optional(),
});

export const updateLanguageRequest = z.object({
  language: language,
});
