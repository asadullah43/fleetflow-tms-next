import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';
import { unaryCall } from './client';

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
  zatcaStatus?: string;
  qrCode?: string;
  invoiceUuid?: string;
}

export const invoicesClient = {
  ...createCrudClient<InvoiceDto>(SERVICE, {
    ListRequest: inv.ListRequest,
    ItemList: inv.InvoiceList,
    Item: inv.Invoice,
    IdRequest: inv.IdRequest,
    CreateRequest: inv.CreateInvoiceRequest,
    UpdateRequest: inv.UpdateInvoiceRequest,
    DeleteResponse: inv.DeleteResponse,
  }),
  markPaid(id: number, token: string): Promise<InvoiceDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'MarkPaid',
      request: inv.IdRequest.create({ id }),
      RequestType: inv.IdRequest,
      ResponseType: inv.Invoice,
      token,
    }) as Promise<InvoiceDto>;
  },
  submitToZatca(id: number, token: string): Promise<InvoiceDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'SubmitToZatca',
      request: inv.IdRequest.create({ id }),
      RequestType: inv.IdRequest,
      ResponseType: inv.Invoice,
      token,
    }) as Promise<InvoiceDto>;
  },
};
