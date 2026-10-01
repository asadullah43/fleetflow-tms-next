import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter } from '../utils/pagination.js';

export const cargoTypesService = createCrudRepository({
  model: 'cargoType',
  errors: {
    notFound: ErrorCode.CGO_NOT_FOUND,
    inUse: ErrorCode.CGO_IN_USE,
    createFailed: ErrorCode.CGO_CREATE_FAILED,
    fetchFailed: ErrorCode.CGO_FETCH_FAILED,
    updateFailed: ErrorCode.CGO_UPDATE_FAILED,
    deleteFailed: ErrorCode.CGO_DELETE_FAILED,
  },
  list: {
    searchFields: ['name', 'nameAr', 'description'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ name: 'name', status: 'status', pricingMode: 'pricingMode' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});
