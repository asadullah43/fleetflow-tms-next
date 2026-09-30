import { fleetflow } from '../generated/proto/messages.js';
import { createCrudClient } from './crud-client';

const { Location, LocationList, ListRequest, IdRequest, CreateLocationRequest, UpdateLocationRequest, DeleteResponse } = fleetflow.locations;

export interface LocationDto {
  id: number;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
}

export const locationsClient = createCrudClient<LocationDto>('fleetflow.locations.LocationsService', {
  ListRequest,
  ItemList: LocationList,
  Item: Location,
  IdRequest,
  CreateRequest: CreateLocationRequest,
  UpdateRequest: UpdateLocationRequest,
  DeleteResponse,
});
