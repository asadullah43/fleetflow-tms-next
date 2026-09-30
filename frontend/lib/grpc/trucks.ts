import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Truck, TruckList, ListRequest, IdRequest, CreateTruckRequest, UpdateTruckRequest, DeleteResponse } = fleetflow.trucks;

export interface TruckDto {
  id: number;
  truckNumber: string;
  truckType?: string;
  status: string;
}

export const trucksClient = createCrudClient<TruckDto>('fleetflow.trucks.TrucksService', {
  ListRequest,
  ItemList: TruckList,
  Item: Truck,
  IdRequest,
  CreateRequest: CreateTruckRequest,
  UpdateRequest: UpdateTruckRequest,
  DeleteResponse,
});
