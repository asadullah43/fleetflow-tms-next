import { z } from 'zod';
import { id, optionalText, requiredText } from './common.validation.js';

const permission = z.object({
  module: requiredText,
  canView: z.boolean(),
  canAdd: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export const createRoleRequest = z.object({
  name: requiredText,
  description: optionalText,
  permissions: z.array(permission).default([]),
});

export const updateRoleRequest = z.object({
  id: id,
  name: optionalText,
  description: optionalText,
  permissions: z.array(permission).default([]),
});
