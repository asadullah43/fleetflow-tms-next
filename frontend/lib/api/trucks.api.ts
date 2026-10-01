import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface TruckDto {
  id: number;
  truckNumber: string;
  truckType?: string;
  status: string;
}

export const trucksApi = createCrudApi<TruckDto>('trucks', 'fleetflow.trucks.TrucksService', fleetflow.trucks, 'Truck');
