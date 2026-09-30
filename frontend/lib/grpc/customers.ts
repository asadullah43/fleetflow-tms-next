import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Customer, CustomerList, ListRequest, IdRequest, CreateCustomerRequest, UpdateCustomerRequest, DeleteResponse } = fleetflow.customers;

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

export const customersClient = createCrudClient<CustomerDto>('fleetflow.customers.CustomersService', {
  ListRequest,
  ItemList: CustomerList,
  Item: Customer,
  IdRequest,
  CreateRequest: CreateCustomerRequest,
  UpdateRequest: UpdateCustomerRequest,
  DeleteResponse,
});
