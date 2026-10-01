import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface DriverDto {
  id: number;
  name: string;
  nameAr?: string;
  phone?: string;
  licenseNo?: string;
  idNumber?: string;
  status: string;
}

export const driversApi = createCrudApi<DriverDto>('drivers', 'fleetflow.drivers.DriversService', fleetflow.drivers, 'Driver');
