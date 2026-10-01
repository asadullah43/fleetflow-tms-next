import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { listCall } from './crud-api';
import type { ListQuery, Page } from './types';

const lo = fleetflow.loadingorders;
const SERVICE = 'fleetflow.loadingorders.LoadingOrdersService';

export interface LoadingOrderDto {
  id: number;
  serialNumber: string;
  batchId: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
  createdAt: string;
  pickupLocationName?: string;
  deliveryLocationName?: string;
  customerName?: string;
  cargoTypeName?: string;
  pickupLocationNameAr?: string;
  deliveryLocationNameAr?: string;
  customerNameAr?: string;
  cargoTypeNameAr?: string;
}

export interface LoadingOrderBatchDto {
  batchId: number;
  firstSerialNumber: string;
  lastSerialNumber: string;
  quantity: number;
  pickupLocationName: string;
  deliveryLocationName: string;
  customerName: string;
  cargoTypeName: string;
  pickupLocationNameAr?: string;
  deliveryLocationNameAr?: string;
  customerNameAr?: string;
  cargoTypeNameAr?: string;
  createdAt: string;
}

/** Company identity as printed on a document. */
export interface DocumentCompanyDto {
  companyName: string;
  logoUrl?: string;
  vatNumber?: string;
  crNumber?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

/** Everything the printable Loading Order shows, straight from the backend. */
export interface LoadingOrderDocumentDto {
  company: DocumentCompanyDto;
  orders: LoadingOrderDto[];
  generatedAt: string;
}

export interface NewLoadingOrders {
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
  quantity: number;
}

export const loadingOrdersApi = {
  key: 'loadingOrders',
  /** One row per batch, paged. */
  listGrouped: (query?: ListQuery): Promise<Page<LoadingOrderBatchDto>> => listCall<LoadingOrderBatchDto>(SERVICE, 'ListGrouped', lo.ListRequest, query),
  getBatchDocument: (batchId: number) => apiCall<LoadingOrderDocumentDto>({ service: SERVICE, method: 'GetBatchDocument', RequestType: lo.DeleteBatchRequest, request: { batchId } }),
  /** Creates `quantity` individually-serialled slips in one batch. */
  create: (values: NewLoadingOrders, idempotencyKey: string) =>
    apiCall<{ items?: LoadingOrderDto[] }>({ service: SERVICE, method: 'Create', RequestType: lo.CreateLoadingOrderRequest, request: { ...values }, idempotencyKey }).then((res) => res.items ?? []),
  removeBatch: (batchId: number) => apiCall({ service: SERVICE, method: 'DeleteBatch', RequestType: lo.DeleteBatchRequest, request: { batchId } }).then(() => undefined),
};
