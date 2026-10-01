import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface SupplierDto {
  id: number;
  name: string;
  nameAr?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  status: string;
}

export const suppliersApi = createCrudApi<SupplierDto>('suppliers', 'fleetflow.suppliers.SuppliersService', fleetflow.suppliers, 'Supplier');
