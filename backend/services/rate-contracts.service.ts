import { blankToUndefined, createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { filter } from '../utils/pagination.js';

const NAME = { select: { name: true, nameAr: true } } as const;

/**
 * One negotiated rate per (customer, pickup, delivery, cargo type) —
 * enforced by the database's unique index, surfaced as RLC_DUPLICATE.
 */
export const rateContractsService = createCrudRepository({
  model: 'rateContract',
  errors: {
    notFound: ErrorCode.RLC_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.RLC_CREATE_FAILED,
    fetchFailed: ErrorCode.RLC_FETCH_FAILED,
    updateFailed: ErrorCode.RLC_UPDATE_FAILED,
    deleteFailed: ErrorCode.RLC_DELETE_FAILED,
    duplicate: ErrorCode.RLC_DUPLICATE,
  },
  include: { customer: NAME, pickupLocation: NAME, deliveryLocation: NAME, cargoType: NAME },
  list: {
    searchFields: ['customer.name', 'customer.nameAr', 'pickupLocation.name', 'deliveryLocation.name', 'cargoType.name'],
    sortFields: { id: 'id', createdAt: 'createdAt', rate: 'rate', customerName: 'customer.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { customerId: filter.id('customerId'), cargoTypeId: filter.id('cargoTypeId') },
  },
  map: (row) => ({
    id: row.id,
    customerId: row.customerId,
    pickupLocationId: row.pickupLocationId,
    deliveryLocationId: row.deliveryLocationId,
    cargoTypeId: row.cargoTypeId,
    rate: row.rate,
    currency: row.currency,
    customerName: row.customer?.name,
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    cargoTypeName: row.cargoType?.name,
    customerNameAr: row.customer?.nameAr,
    pickupLocationNameAr: row.pickupLocation?.nameAr,
    deliveryLocationNameAr: row.deliveryLocation?.nameAr,
    cargoTypeNameAr: row.cargoType?.nameAr,
  }),
  toCreate: (input) => ({ ...input, currency: input.currency || 'SAR' }),
  toUpdate: (input) => blankToUndefined(input, ['rate', 'currency']),
});
