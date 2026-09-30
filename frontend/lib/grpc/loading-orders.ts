import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { LoadingOrder, LoadingOrderList, ListRequest, IdRequest, CreateLoadingOrderRequest, UpdateLoadingOrderRequest, DeleteResponse } =
  fleetflow.loadingorders;

export interface LoadingOrderDto {
  id: number;
  serialNumber: string;
  batchId: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
  pickupLocationName?: string;
  deliveryLocationName?: string;
  customerName?: string;
  cargoTypeName?: string;
}

export const loadingOrdersClient = createCrudClient<LoadingOrderDto>('fleetflow.loadingorders.LoadingOrdersService', {
  ListRequest,
  ItemList: LoadingOrderList,
  Item: LoadingOrder,
  IdRequest,
  CreateRequest: CreateLoadingOrderRequest,
  UpdateRequest: UpdateLoadingOrderRequest,
  DeleteResponse,
});
