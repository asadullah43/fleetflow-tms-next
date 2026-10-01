import { z } from 'zod';
import { decimalString, id, optionalDateString, optionalDecimalString, optionalId, optionalText } from './common.validation.js';

export const createSupplierPaymentRequest = z.object({
  supplierId: id,
  amount: decimalString,
  currency: optionalText,
  paymentDate: optionalDateString,
  description: optionalText,
});

export const updateSupplierPaymentRequest = z.object({
  id: id,
  supplierId: optionalId,
  amount: optionalDecimalString,
  currency: optionalText,
  paymentDate: optionalDateString,
  description: optionalText,
});
