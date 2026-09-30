import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { CargoType, CargoTypeList, ListRequest, IdRequest, CreateCargoTypeRequest, UpdateCargoTypeRequest, DeleteResponse } = fleetflow.cargotypes;

export interface CargoTypeDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  pricingMode: string;
}

export const cargoTypesClient = createCrudClient<CargoTypeDto>('fleetflow.cargotypes.CargoTypesService', {
  ListRequest,
  ItemList: CargoTypeList,
  Item: CargoType,
  IdRequest,
  CreateRequest: CreateCargoTypeRequest,
  UpdateRequest: UpdateCargoTypeRequest,
  DeleteResponse,
});
