import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { RateContract, RateContractList, ListRequest, IdRequest, CreateRateContractRequest, UpdateRateContractRequest, DeleteResponse } =
  fleetflow.ratecontracts;

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
}

export const rateContractsClient = createCrudClient<RateContractDto>('fleetflow.ratecontracts.RateContractsService', {
  ListRequest,
  ItemList: RateContractList,
  Item: RateContract,
  IdRequest,
  CreateRequest: CreateRateContractRequest,
  UpdateRequest: UpdateRateContractRequest,
  DeleteResponse,
});
