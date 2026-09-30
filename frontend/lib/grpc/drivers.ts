import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Driver, DriverList, ListRequest, IdRequest, CreateDriverRequest, UpdateDriverRequest, DeleteResponse } = fleetflow.drivers;

export interface DriverDto {
  id: number;
  name: string;
  nameAr?: string;
  phone?: string;
  licenseNo?: string;
  idNumber?: string;
  status: string;
}

export const driversClient = createCrudClient<DriverDto>('fleetflow.drivers.DriversService', {
  ListRequest,
  ItemList: DriverList,
  Item: Driver,
  IdRequest,
  CreateRequest: CreateDriverRequest,
  UpdateRequest: UpdateDriverRequest,
  DeleteResponse,
});
