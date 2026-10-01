import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter } from '../utils/pagination.js';

export const customersService = createCrudRepository({
  model: 'customer',
  errors: {
    notFound: ErrorCode.CUS_NOT_FOUND,
    inUse: ErrorCode.CUS_IN_USE,
    createFailed: ErrorCode.CUS_CREATE_FAILED,
    fetchFailed: ErrorCode.CUS_FETCH_FAILED,
    updateFailed: ErrorCode.CUS_UPDATE_FAILED,
    deleteFailed: ErrorCode.CUS_DELETE_FAILED,
  },
  list: {
    searchFields: ['name', 'nameAr', 'contactPerson', 'phone', 'email', 'vatNumber'],
    sortFields: { id: 'id', createdAt: 'createdAt', ...{ name: 'name', status: 'status' } },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => buildLocalizedWriteData(input, true),
  toUpdate: (input) => buildLocalizedWriteData(input, false),
});
