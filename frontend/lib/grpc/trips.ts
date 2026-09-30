import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Trip, TripList, ListRequest, IdRequest, CreateTripRequest, UpdateTripRequest, DeleteResponse } = fleetflow.trips;

export interface TripDto {
  id: number;
  transactionNumber: string;
  supplierId?: number;
  customerId?: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  cargoTypeId: number;
  quantity: string;
  tripDate: string;
  truckId: number;
  driverId?: number;
  invoiceId?: number;
  supplierName?: string;
  customerName?: string;
  pickupLocationName?: string;
  deliveryLocationName?: string;
  cargoTypeName?: string;
  truckNumber?: string;
  driverName?: string;
}

export const tripsClient = createCrudClient<TripDto>('fleetflow.trips.TripsService', {
  ListRequest,
  ItemList: TripList,
  Item: Trip,
  IdRequest,
  CreateRequest: CreateTripRequest,
  UpdateRequest: UpdateTripRequest,
  DeleteResponse,
});
