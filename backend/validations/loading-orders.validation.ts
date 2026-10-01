import { z } from 'zod';
import { id } from './common.validation.js';

export const createLoadingOrderRequest = z.object({
  pickupLocationId: id,
  deliveryLocationId: id,
  customerId: id,
  cargoTypeId: id,
  quantity: z.number().int().min(0).max(200), // 0 (unset) means 1
});

export const batchRequest = z.object({ batchId: id });
