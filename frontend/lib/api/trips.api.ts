import { fleetflow } from '../generated/proto/messages.js';
import { createCrudApi } from './crud-api';

export interface TripDto {
  id: number;
  transactionNumber: string;
  supplierId?: number;
  customerId?: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  cargoTypeId: number;
  quantity: string;
  tripDate: string;
  truckId: number;
  driverId?: number;
  /** The invoice that links this trip (set from the invoice side). */
  invoiceId?: number;
  invoiceNumber?: string;
  supplierName?: string;
  customerName?: string;
  pickupLocationName?: string;
  deliveryLocationName?: string;
  cargoTypeName?: string;
  truckNumber?: string;
  driverName?: string;
  supplierNameAr?: string;
  customerNameAr?: string;
  pickupLocationNameAr?: string;
  deliveryLocationNameAr?: string;
  cargoTypeNameAr?: string;
  driverNameAr?: string;
}

export const tripsApi = createCrudApi<TripDto>('trips', 'fleetflow.trips.TripsService', fleetflow.trips, 'Trip');
