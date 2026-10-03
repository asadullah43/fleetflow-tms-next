import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { createCrudApi } from './crud-api';

const inv = fleetflow.invoices;
const SERVICE = 'fleetflow.invoices.InvoicesService';

export interface InvoiceLineItemDto {
  id?: number;
  description: string;
  quantity: string;
  rate: string;
  amount?: string;
  taxCategory?: string;
  taxPercent?: string;
  taxAmount?: string;
}

export interface InvoiceDto {
  id: number;
  invoiceNumber: string;
  customerId: number;
  issueDate: string;
  dueDate: string;
  fromDate: string;
  toDate: string;
  currency: string;
  invoiceType: string;
  paymentMeans: string;
  vatEnabled: boolean;
  vatPercent: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  status: string;
  paidAt?: string;
  lineItems: InvoiceLineItemDto[];
  customerName?: string;
  customerNameAr?: string;
  zatcaStatus?: string;
  qrCode?: string;
  invoiceUuid?: string;
  /** The trip this invoice is for, if one is linked (a reference only). */
  tripId?: number;
  tripTransactionNumber?: string;
}

export const invoicesApi = {
  ...createCrudApi<InvoiceDto>('invoices', SERVICE, inv, 'Invoice'),
  markPaid: (id: number) => apiCall<InvoiceDto>({ service: SERVICE, method: 'MarkPaid', RequestType: inv.IdRequest, request: { id } }),
  submitToZatca: (id: number) => apiCall<InvoiceDto>({ service: SERVICE, method: 'SubmitToZatca', RequestType: inv.IdRequest, request: { id } }),
};
