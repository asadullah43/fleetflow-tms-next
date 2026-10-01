import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface LocationDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
}

export const locationsApi = createCrudApi<LocationDto>('locations', 'fleetflow.locations.LocationsService', fleetflow.locations, 'Location');
