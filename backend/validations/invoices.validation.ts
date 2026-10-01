import { z } from 'zod';
import { dateString, decimalString, id, optionalDateString, optionalDecimalString, optionalId, optionalText, requiredText } from './common.validation.js';

const invoiceLineItemInput = z.object({
  description: requiredText,
  quantity: decimalString,
  rate: decimalString,
  taxCategory: optionalText,
  taxPercent: optionalDecimalString,
});

export const createInvoiceRequest = z.object({
  customerId: id,
  dueDate: dateString,
  fromDate: dateString,
  toDate: dateString,
  currency: optionalText,
  invoiceType: optionalText,
  paymentMeans: optionalText,
  vatEnabled: z.boolean().optional(),
  vatPercent: optionalDecimalString,
  lineItems: z.array(invoiceLineItemInput).default([]),
});

export const updateInvoiceRequest = z.object({
  id: id,
  customerId: optionalId,
  dueDate: optionalDateString,
  fromDate: optionalDateString,
  toDate: optionalDateString,
  currency: optionalText,
  invoiceType: optionalText,
  paymentMeans: optionalText,
  vatEnabled: z.boolean().optional(),
  vatPercent: optionalDecimalString,
  status: optionalText,
  lineItems: z.array(invoiceLineItemInput).default([]),
});
