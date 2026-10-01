import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter } from '../utils/pagination.js';

export const suppliersService = createCrudRepository({
  model: 'supplier',
  errors: {
    notFound: ErrorCode.SUP_NOT_FOUND,
    inUse: ErrorCode.SUP_IN_USE,
    createFailed: ErrorCode.SUP_CREATE_FAILED,
    fetchFailed: ErrorCode.SUP_FETCH_FAILED,
    updateFailed: ErrorCode.SUP_UPDATE_FAILED,
    deleteFailed: ErrorCode.SUP_DELETE_FAILED,
  },
  list: {
    searchFields: ['name', 'nameAr', 'contactPerson', 'phone', 'email'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ name: 'name', status: 'status' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});
