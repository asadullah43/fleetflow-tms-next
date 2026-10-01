import { z } from 'zod';
import { requiredText } from './common.validation.js';

const scope = z.object({
  module: requiredText,
  canView: z.boolean(),
  canAdd: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export const createApiKeyRequest = z.object({
  name: requiredText.pipe(z.string().max(100)),
  scopes: z.array(scope).max(50).default([]),
});
