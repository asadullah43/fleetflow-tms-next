import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface RateContractDto {
  id: number;
  customerId: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  cargoTypeId: number;
  rate: string;
  currency: string;
  customerName?: string;
  pickupLocationName?: string;
  deliveryLocationName?: string;
  cargoTypeName?: string;
  customerNameAr?: string;
  pickupLocationNameAr?: string;
  deliveryLocationNameAr?: string;
  cargoTypeNameAr?: string;
}

export const rateContractsApi = createCrudApi<RateContractDto>('rateContracts', 'fleetflow.ratecontracts.RateContractsService', fleetflow.ratecontracts, 'RateContract');
