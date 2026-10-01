import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface CustomerDto {
  id: number;
  name: string;
  nameAr?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  vatNumber?: string;
  crNumber?: string;
  streetName?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  status: string;
}

export const customersApi = createCrudApi<CustomerDto>('customers', 'fleetflow.customers.CustomersService', fleetflow.customers, 'Customer');
