import { z } from 'zod';
import { decimalString, id, optionalDecimalString, optionalId, optionalText } from './common.validation.js';

export const createRateContractRequest = z.object({
  customerId: id,
  pickupLocationId: id,
  deliveryLocationId: id,
  cargoTypeId: id,
  rate: decimalString,
  currency: optionalText,
});

export const updateRateContractRequest = z.object({
  id: id,
  customerId: optionalId,
  pickupLocationId: optionalId,
  deliveryLocationId: optionalId,
  cargoTypeId: optionalId,
  rate: optionalDecimalString,
  currency: optionalText,
});
