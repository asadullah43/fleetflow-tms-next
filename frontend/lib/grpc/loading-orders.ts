import { fleetflow } from '../generated/proto/messages.js';
import { unaryCall } from './client';

const { ListRequest, LoadingOrderBatchList, CreateLoadingOrderRequest, LoadingOrderList, DeleteBatchRequest, DeleteResponse } = fleetflow.loadingorders;

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

export const loadingOrdersClient = {
  listGrouped(token: string): Promise<LoadingOrderBatchDto[]> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'ListGrouped',
      request: ListRequest.create({}),
      RequestType: ListRequest,
      ResponseType: LoadingOrderBatchList,
      token,
    }).then((res) => (res.items ?? []) as unknown as LoadingOrderBatchDto[]);
  },

  getBatch(batchId: number, token: string): Promise<LoadingOrderDto[]> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'GetBatch',
      request: DeleteBatchRequest.create({ batchId }),
      RequestType: DeleteBatchRequest,
      ResponseType: LoadingOrderList,
      token,
    }).then((res) => (res.items ?? []) as unknown as LoadingOrderDto[]);
  },

  /** Creates `quantity` individually-serialled orders in one batch; returns every row created (for the printable slip). */
  create(
    values: { pickupLocationId: number; deliveryLocationId: number; customerId: number; cargoTypeId: number; quantity: number },
    token: string,
  ): Promise<LoadingOrderDto[]> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Create',
      request: CreateLoadingOrderRequest.create(values),
      RequestType: CreateLoadingOrderRequest,
      ResponseType: LoadingOrderList,
      token,
    }).then((res) => (res.items ?? []) as unknown as LoadingOrderDto[]);
  },

  removeBatch(batchId: number, token: string): Promise<void> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'DeleteBatch',
      request: DeleteBatchRequest.create({ batchId }),
      RequestType: DeleteBatchRequest,
      ResponseType: DeleteResponse,
      token,
    }).then(() => undefined);
  },
};
