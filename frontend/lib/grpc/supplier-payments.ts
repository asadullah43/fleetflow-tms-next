import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { SupplierPayment, SupplierPaymentList, ListRequest, IdRequest, CreateSupplierPaymentRequest, UpdateSupplierPaymentRequest, DeleteResponse } =
  fleetflow.supplierpayments;

export interface SupplierPaymentDto {
  id: number;
  supplierId: number;
  amount: string;
  currency: string;
  paymentDate: string;
  description?: string;
  supplierName?: string;
}

export const supplierPaymentsClient = createCrudClient<SupplierPaymentDto>('fleetflow.supplierpayments.SupplierPaymentsService', {
  ListRequest,
  ItemList: SupplierPaymentList,
  Item: SupplierPayment,
  IdRequest,
  CreateRequest: CreateSupplierPaymentRequest,
  UpdateRequest: UpdateSupplierPaymentRequest,
  DeleteResponse,
});
