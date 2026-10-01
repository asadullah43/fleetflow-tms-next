import { z } from 'zod';
import { id, optionalText, requiredText } from './common.validation.js';

export const createTruckRequest = z.object({
  truckNumber: requiredText,
  truckType: optionalText,
  status: optionalText,
});

export const updateTruckRequest = z.object({
  id: id,
  truckNumber: optionalText,
  truckType: optionalText,
  status: optionalText,
});
