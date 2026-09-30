import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Supplier, SupplierList, ListRequest, IdRequest, CreateSupplierRequest, UpdateSupplierRequest, DeleteResponse } = fleetflow.suppliers;

export interface SupplierDto {
  id: number;
  name: string;
  nameAr?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  status: string;
}

export const suppliersClient = createCrudClient<SupplierDto>('fleetflow.suppliers.SuppliersService', {
  ListRequest,
  ItemList: SupplierList,
  Item: Supplier,
  IdRequest,
  CreateRequest: CreateSupplierRequest,
  UpdateRequest: UpdateSupplierRequest,
  DeleteResponse,
});
