import { z } from 'zod';
import { dateString, decimalString, id, optionalDateString, optionalDecimalString, optionalId, optionalText, requiredText } from './common.validation.js';

export const createTripRequest = z.object({
  transactionNumber: requiredText,
  supplierId: optionalId,
  customerId: optionalId,
  pickupLocationId: id,
  deliveryLocationId: id,
  cargoTypeId: id,
  quantity: decimalString,
  tripDate: dateString,
  truckId: id,
  driverId: optionalId,
});

export const updateTripRequest = z.object({
  id: id,
  transactionNumber: optionalText,
  supplierId: optionalId,
  customerId: optionalId,
  pickupLocationId: optionalId,
  deliveryLocationId: optionalId,
  cargoTypeId: optionalId,
  quantity: optionalDecimalString,
  tripDate: optionalDateString,
  truckId: optionalId,
  driverId: optionalId,
});
