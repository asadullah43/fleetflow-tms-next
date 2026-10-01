import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface SupplierPaymentDto {
  id: number;
  supplierId: number;
  amount: string;
  currency: string;
  paymentDate: string;
  description?: string;
  supplierName?: string;
  supplierNameAr?: string;
}

export const supplierPaymentsApi = createCrudApi<SupplierPaymentDto>('supplierPayments', 'fleetflow.supplierpayments.SupplierPaymentsService', fleetflow.supplierpayments, 'SupplierPayment');
