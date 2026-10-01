import { blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { filter } from '../utils/pagination.js';
import { assignmentsService } from './assignments.service.js';

const NAME = { select: { name: true, nameAr: true } } as const;

interface TripInput {
  transactionNumber?: string;
  supplierId?: number;
  customerId?: number;
  pickupLocationId?: number;
  deliveryLocationId?: number;
  cargoTypeId?: number;
  quantity?: string;
  tripDate?: string;
  truckId?: number;
  driverId?: number;
}

/**
 * The central transaction record linking a truck/driver run between two
 * locations for a customer or supplier and a cargo type.
 * `transactionNumber` is entered by the user and unique per company; a
 * clash maps to TRP_DUPLICATE_TRANSACTION.
 */
export const tripsService = createCrudRepository({
  model: 'trip',
  errors: {
    notFound: ErrorCode.TRP_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.TRP_CREATE_FAILED,
    fetchFailed: ErrorCode.TRP_FETCH_FAILED,
    updateFailed: ErrorCode.TRP_UPDATE_FAILED,
    deleteFailed: ErrorCode.TRP_DELETE_FAILED,
    duplicate: ErrorCode.TRP_DUPLICATE_TRANSACTION,
  },
  include: {
    supplier: NAME,
    customer: NAME,
    pickupLocation: NAME,
    deliveryLocation: NAME,
    cargoType: NAME,
    truck: { select: { truckNumber: true } },
    driver: NAME,
  },
  list: {
    searchFields: [
      'transactionNumber',
      'customer.name',
      'customer.nameAr',
      'driver.name',
      'driver.nameAr',
      'truck.truckNumber',
      'pickupLocation.name',
      'deliveryLocation.name',
      'cargoType.name',
    ],
    sortFields: { id: 'id', tripDate: 'tripDate', transactionNumber: 'transactionNumber', quantity: 'quantity' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: {
      fromDate: filter.dateFrom('tripDate'),
      toDate: filter.dateTo('tripDate'),
      customerId: filter.id('customerId'),
      supplierId: filter.id('supplierId'),
      driverId: filter.id('driverId'),
      truckId: filter.id('truckId'),
      pickupLocationId: filter.id('pickupLocationId'),
      deliveryLocationId: filter.id('deliveryLocationId'),
      cargoTypeId: filter.id('cargoTypeId'),
    },
  },
  map: (row) => ({
    id: row.id,
    transactionNumber: row.transactionNumber,
    supplierId: row.supplierId,
    customerId: row.customerId,
    pickupLocationId: row.pickupLocationId,
    deliveryLocationId: row.deliveryLocationId,
    cargoTypeId: row.cargoTypeId,
    quantity: row.quantity,
    tripDate: row.tripDate,
    truckId: row.truckId,
    driverId: row.driverId,
    invoiceId: row.invoiceId,
    supplierName: row.supplier?.name,
    customerName: row.customer?.name,
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    cargoTypeName: row.cargoType?.name,
    truckNumber: row.truck?.truckNumber,
    driverName: row.driver?.name,
    supplierNameAr: row.supplier?.nameAr,
    customerNameAr: row.customer?.nameAr,
    pickupLocationNameAr: row.pickupLocation?.nameAr,
    deliveryLocationNameAr: row.deliveryLocation?.nameAr,
    cargoTypeNameAr: row.cargoType?.nameAr,
    driverNameAr: row.driver?.nameAr,
  }),
  toCreate: async (input: Required<Pick<TripInput, 'truckId' | 'tripDate'>> & TripInput) => {
    const tripDate = new Date(input.tripDate);
    // No driver chosen: use whoever is assigned to the truck on the trip date (may be nobody).
    const driverId = input.driverId ?? (await assignmentsService.driverForTruckOn(input.truckId, tripDate));
    return { ...input, tripDate, driverId, supplierId: input.supplierId ?? null, customerId: input.customerId ?? null };
  },
  toUpdate: ({ id: _id, ...input }: TripInput & { id?: number }) => blankToUndefined(withDates(input, ['tripDate']), ['transactionNumber', 'quantity']),
});
