import { z } from 'zod';
import { dateString, decimalString, endOnOrAfterStart, id, optionalDateString, optionalId, optionalPercentString, optionalText, requiredText } from './common.validation.js';

const invoiceLineItemInput = z.object({
  description: requiredText,
  quantity: decimalString,
  rate: decimalString,
  taxCategory: optionalText,
  taxPercent: optionalPercentString,
});

export const createInvoiceRequest = endOnOrAfterStart(
  z.object({
  customerId: id,
  dueDate: dateString,
  fromDate: dateString,
  toDate: dateString,
  currency: optionalText,
  invoiceType: optionalText,
  paymentMeans: optionalText,
  vatEnabled: z.boolean().optional(),
  vatPercent: optionalPercentString,
  lineItems: z.array(invoiceLineItemInput).default([]),
  /** The trip this invoice is for (a reference only: neither record changes the other). */
  tripId: optionalId,
  }),
  'fromDate',
  'toDate',
);

export const updateInvoiceRequest = endOnOrAfterStart(
  z.object({
  id: id,
  customerId: optionalId,
  dueDate: optionalDateString,
  fromDate: optionalDateString,
  toDate: optionalDateString,
  currency: optionalText,
  invoiceType: optionalText,
  paymentMeans: optionalText,
  vatEnabled: z.boolean().optional(),
  vatPercent: optionalPercentString,
  status: optionalText,
  lineItems: z.array(invoiceLineItemInput).default([]),
  /** A trip id to link (replacing any linked one), 0 to unlink, absent to leave it as it is. */
  tripId: z.number().int().nonnegative().optional(),
  }),
  'fromDate',
  'toDate',
);
