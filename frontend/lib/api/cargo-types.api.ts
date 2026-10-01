import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface CargoTypeDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  pricingMode: string;
}

export const cargoTypesApi = createCrudApi<CargoTypeDto>('cargoTypes', 'fleetflow.cargotypes.CargoTypesService', fleetflow.cargotypes, 'CargoType');
