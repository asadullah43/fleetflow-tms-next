import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { filter } from '../utils/pagination.js';

export const trucksService = createCrudRepository({
  model: 'truck',
  errors: {
    notFound: ErrorCode.TRK_NOT_FOUND,
    inUse: ErrorCode.TRK_IN_USE,
    createFailed: ErrorCode.TRK_CREATE_FAILED,
    fetchFailed: ErrorCode.TRK_FETCH_FAILED,
    updateFailed: ErrorCode.TRK_UPDATE_FAILED,
    deleteFailed: ErrorCode.TRK_DELETE_FAILED,
  },
  list: {
    searchFields: ['truckNumber', 'truckType'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ truckNumber: 'truckNumber', truckType: 'truckType', status: 'status' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
});
